import type { ClientOptions } from './ClientOptions.js';
import { detectApiVersion } from './detectApiVersion.js';
import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import type { EventType } from './EventType.js';
import { isAbortError } from './http/isAbortError.js';
import { waitUnlessAborted } from './http/waitUnlessAborted.js';
import { IncompatibleServerError } from './IncompatibleServerError.js';
import type { ObserveEventsOptions } from './ObserveEventsOptions.js';
import type { Precondition } from './Precondition.js';
import type { ReadEventsOptions } from './ReadEventsOptions.js';
import type { ReadSubjectsOptions } from './ReadSubjectsOptions.js';
import { defaultStallTimeout, maximumStallTimeout } from './stall/defaultStallTimeout.js';
import type { Transport, TransportOptions } from './Transport.js';
import { hasShapeOf } from './types/hasShapeOf.js';
import { isBoolean } from './types/isBoolean.js';
import { V1Transport } from './v1/V1Transport.js';
import { V2Transport } from './v2/V2Transport.js';

// Reads a stream through the transport, unless the caller aborts while the
// client finds out which one to use, which ends the stream, as aborting it
// does at any other time.
const streamThrough = async function* <TItem>(
	getTransport: () => Promise<Transport>,
	stream: (transport: Transport) => AsyncGenerator<TItem, void, void>,
): AsyncGenerator<TItem, void, void> {
	let transport: Transport;

	try {
		transport = await getTransport();
	} catch (error) {
		if (isAbortError(error)) {
			return;
		}
		throw error;
	}

	yield* stream(transport);
};

class Client {
	readonly #transportOptions: TransportOptions;
	#transport: Transport | undefined;
	#detection: Promise<Transport> | undefined;

	public constructor(url: URL, apiToken: string, options: ClientOptions = {}) {
		const stallTimeout = options.stallTimeout ?? defaultStallTimeout;

		if (!(stallTimeout >= 1 && stallTimeout <= maximumStallTimeout)) {
			throw new Error(
				`Stall timeout must be between 1 and ${maximumStallTimeout} milliseconds, got '${stallTimeout}'.`,
			);
		}

		this.#transportOptions = { url, apiToken, stallTimeout };
	}

	// This is the one place that chooses between the APIs. The first request of
	// a client finds out which API the server offers, and the client keeps the
	// answer. Requests that start meanwhile wait for the same answer. If the
	// client fails to find out, the request fails, and the next one tries again.
	// The same holds once the client forgets the answer, as #createV2Transport
	// and writeEvents describe.
	async #getTransport(signal?: AbortSignal): Promise<Transport> {
		if (this.#transport !== undefined) {
			return this.#transport;
		}

		signal?.throwIfAborted();

		if (this.#detection === undefined) {
			const detection = detectApiVersion(this.#transportOptions).then(apiVersion => {
				this.#transport =
					apiVersion === 'v2' ? this.#createV2Transport() : new V1Transport(this.#transportOptions);

				return this.#transport;
			});

			const forget = (): void => {
				if (this.#detection === detection) {
					this.#detection = undefined;
				}
			};
			detection.then(forget, forget);

			this.#detection = detection;
		}

		return await waitUnlessAborted(this.#detection, signal);
	}

	// Only the transport that the client still keeps makes it forget which API
	// the server offers. So a late answer to a request through a transport that
	// the client has forgotten already neither disturbs finding out anew, which
	// may run meanwhile, nor discards what that finds.
	#forget(transport: Transport): void {
		if (this.#transport === transport) {
			this.#transport = undefined;
		}
	}

	// A server that answers a path of the v2 API with 404 or 405 no longer
	// offers it, for example because it was rolled back to a version without
	// it, so the client forgets the answer, and the next request finds out
	// again, while the request itself fails as before.
	#createV2Transport(): V2Transport {
		const transport = new V2Transport({
			...this.#transportOptions,
			forgetApiVersion: (): void => {
				this.#forget(transport);
			},
		});

		return transport;
	}

	public async ping(signal?: AbortSignal): Promise<void> {
		const transport = await this.#getTransport(signal);
		await transport.ping(signal);
	}

	public async verifyApiToken(signal?: AbortSignal): Promise<void> {
		const transport = await this.#getTransport(signal);
		await transport.verifyApiToken(signal);
	}

	// A write that fails once it may have reached the server fails with an
	// OutcomeUnknownError, since it may have been stored nonetheless. This
	// includes aborting the signal once the write has been sent.
	//
	// The v1 API cannot carry a write with a recursive precondition, so its
	// transport refuses such a write before sending it. The server may offer
	// the v2 API by now, for example after an upgrade, so the client forgets
	// the answer and finds out again, as on its first request, and sends the
	// write through the API it finds. If that is still the v1 API, the write
	// fails with an IncompatibleServerError, again without being sent. Since
	// the first attempt never sends the write, it is sent at most once.
	public async writeEvents(
		events: EventCandidate[],
		preconditions: Precondition[] = [],
		signal?: AbortSignal,
	): Promise<Event[]> {
		const transport = await this.#getTransport(signal);

		try {
			return await transport.writeEvents(events, preconditions, signal);
		} catch (error) {
			if (!(error instanceof IncompatibleServerError)) {
				throw error;
			}
		}

		this.#forget(transport);
		const currentTransport = await this.#getTransport(signal);

		return await currentTransport.writeEvents(events, preconditions, signal);
	}

	public readEvents(
		subject: string,
		options: ReadEventsOptions,
		signal?: AbortSignal,
	): AsyncGenerator<Event, void, void> {
		return streamThrough(
			async () => await this.#getTransport(signal),
			transport => transport.readEvents(subject, options, signal),
		);
	}

	public runEventQlQuery(query: string, signal?: AbortSignal): AsyncGenerator<unknown, void, void> {
		return streamThrough(
			async () => await this.#getTransport(signal),
			transport => transport.runEventQlQuery(query, signal),
		);
	}

	public observeEvents(
		subject: string,
		options: ObserveEventsOptions,
		signal?: AbortSignal,
	): AsyncGenerator<Event, void, void> {
		return streamThrough(
			async () => await this.#getTransport(signal),
			transport => transport.observeEvents(subject, options, signal),
		);
	}

	// Registering an event schema is a write, so it fails like writeEvents does.
	public async registerEventSchema(
		eventType: string,
		schema: Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<void> {
		const transport = await this.#getTransport(signal);
		await transport.registerEventSchema(eventType, schema, signal);
	}

	public readSubjects(
		subject: string,
		options: ReadSubjectsOptions,
		signal?: AbortSignal,
	): AsyncGenerator<string, void, void> {
		// The option decides whether to read the subject alone or with all the
		// subjects below it, so it has no default, and a caller without types has
		// to set it as well.
		if (!hasShapeOf<ReadSubjectsOptions>(options, { recursive: isBoolean })) {
			throw new Error("Option 'recursive' must be set to true or false.");
		}

		const { recursive } = options;

		return streamThrough(
			async () => await this.#getTransport(signal),
			transport => transport.readSubjects(subject, { recursive }, signal),
		);
	}

	public async readEventType(eventType: string, signal?: AbortSignal): Promise<EventType> {
		const transport = await this.#getTransport(signal);
		return await transport.readEventType(eventType, signal);
	}

	public readEventTypes(signal?: AbortSignal): AsyncGenerator<EventType, void, void> {
		return streamThrough(
			async () => await this.#getTransport(signal),
			transport => transport.readEventTypes(signal),
		);
	}
}

export { Client };
