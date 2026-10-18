import { convertCloudEventToEvent } from '../convertCloudEventToEvent.js';
import { DbApiError } from '../DbApiError.js';
import type { Event } from '../Event.js';
import type { EventCandidate } from '../EventCandidate.js';
import type { EventType } from '../EventType.js';
import { assertEventSourcingDb } from '../http/assertEventSourcingDb.js';
import { createDbApiErrorFromResponse } from '../http/createDbApiErrorFromResponse.js';
import { createStreamEndedError } from '../http/createStreamEndedError.js';
import { runWrite } from '../http/runWrite.js';
import { isCloudEvent } from '../isCloudEvent.js';
import { getRawJsonElements } from '../json/getRawJsonElements.js';
import { getRawJsonMember } from '../json/getRawJsonMember.js';
import { readNdJsonStream } from '../ndjson/readNdJsonStream.js';
import type { ObserveEventsOptions } from '../ObserveEventsOptions.js';
import type { Precondition } from '../Precondition.js';
import type { ReadEventsOptions } from '../ReadEventsOptions.js';
import type { ReadSubjectsOptions } from '../ReadSubjectsOptions.js';
import { readResponseText } from '../stall/readResponseText.js';
import { runWithStallGuard } from '../stall/runWithStallGuard.js';
import type { StallGuard } from '../stall/StallGuard.js';
import { streamWithStallGuard } from '../stall/streamWithStallGuard.js';
import type { Transport, TransportOptions } from '../Transport.js';
import { hasShapeOf } from '../types/hasShapeOf.js';
import { isBoolean } from '../types/isBoolean.js';
import { isString } from '../types/isString.js';
import { getV1ErrorCode } from './getV1ErrorCode.js';
import { isV1Refusal } from './isV1Refusal.js';
import { normalizeSubject } from './normalizeSubject.js';
import { isStreamCloudEvent } from './stream/isStreamCloudEvent.js';
import { isStreamError } from './stream/isStreamError.js';
import { isStreamEventType } from './stream/isStreamEventType.js';
import { isStreamHeartbeat } from './stream/isStreamHeartbeat.js';
import { isStreamRow } from './stream/isStreamRow.js';
import { isStreamSubject } from './stream/isStreamSubject.js';

interface ResponseBodyPing {
	type: string;
}

interface ResponseBodyVerifyApiToken {
	type: string;
}

interface V1EventType {
	eventType: string;
	isPhantom: boolean;
	schema?: Record<string, unknown>;
}

// The v1 API names an event type that has no events a phantom.
const toEventType = ({ eventType, isPhantom, schema }: V1EventType): EventType => ({
	type: eventType,
	hasEvents: !isPhantom,
	...(schema === undefined ? {} : { schema }),
});

// Fails unless the server answered the call of the v1 API with the status 200.
const assertOk = async (
	response: Response,
	stallGuard: StallGuard,
	call: keyof Transport,
): Promise<void> => {
	assertEventSourcingDb(response);

	if (response.status !== 200) {
		throw await createDbApiErrorFromResponse(response, stallGuard, (status, description) =>
			getV1ErrorCode(call, status, description),
		);
	}
};

const getStreamBody = async (
	response: Response,
	stallGuard: StallGuard,
	call: keyof Transport,
	action: string,
): Promise<ReadableStream<Uint8Array>> => {
	await assertOk(response, stallGuard, call);

	if (!response.body) {
		throw new Error(`Failed to ${action}.`);
	}

	return response.body;
};

const createStreamError = (error: string): DbApiError =>
	new DbApiError({ status: 200, description: error });

// Sends the requests through the v1 API, which EventSourcingDB 1.2.0 offers.
class V1Transport implements Transport {
	readonly #url: URL;
	readonly #apiToken: string;
	readonly #stallTimeout: number;

	#getUrl(path: string): string {
		return new URL(path, this.#url).toString();
	}

	public constructor({ url, apiToken, stallTimeout }: TransportOptions) {
		this.#url = url;
		this.#apiToken = apiToken;
		this.#stallTimeout = stallTimeout;
	}

	public async ping(signal?: AbortSignal): Promise<void> {
		const url = this.#getUrl('/api/v1/ping');
		const stallTimeout = this.#stallTimeout;

		await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
			const response = await stallGuard.send(url, {
				method: 'GET',
			});

			await assertOk(response, stallGuard, 'ping');

			const responseBody: unknown = JSON.parse(await readResponseText(response, stallGuard));
			if (
				!hasShapeOf<ResponseBodyPing>(responseBody, {
					type: isString,
				})
			) {
				throw new Error('Failed to parse response.');
			}

			const eventType = 'io.eventsourcingdb.api.ping-received';
			if (responseBody.type !== eventType) {
				throw new Error('Failed to ping.');
			}
		});
	}

	public async verifyApiToken(signal?: AbortSignal): Promise<void> {
		const url = this.#getUrl('/api/v1/verify-api-token');
		const stallTimeout = this.#stallTimeout;

		await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
			const response = await stallGuard.send(url, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${this.#apiToken}`,
				},
			});

			await assertOk(response, stallGuard, 'verifyApiToken');

			const responseBody: unknown = JSON.parse(await readResponseText(response, stallGuard));
			if (
				!hasShapeOf<ResponseBodyVerifyApiToken>(responseBody, {
					type: isString,
				})
			) {
				throw new Error('Failed to parse response.');
			}

			const eventType = 'io.eventsourcingdb.api.api-token-verified';
			if (responseBody.type !== eventType) {
				throw new Error('Failed to verify API token.');
			}
		});
	}

	public async writeEvents(
		events: EventCandidate[],
		preconditions: Precondition[],
		signal?: AbortSignal,
	): Promise<Event[]> {
		const url = this.#getUrl('/api/v1/write-events');
		const stallTimeout = this.#stallTimeout;
		const body = JSON.stringify({
			events,
			preconditions,
		});

		return await runWrite(
			{ signal, isRefusal: isV1Refusal },
			async () =>
				await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
					const response = await stallGuard.send(url, {
						method: 'POST',
						headers: {
							authorization: `Bearer ${this.#apiToken}`,
							'content-type': 'application/json',
						},
						body,
					});

					await assertOk(response, stallGuard, 'writeEvents');

					const responseText = await readResponseText(response, stallGuard);
					const responseBody: unknown = JSON.parse(responseText);

					if (!Array.isArray(responseBody)) {
						throw new Error('Failed to parse response.');
					}

					const responseItemTexts = getRawJsonElements(responseText);

					return responseBody.map((item: unknown, index) => {
						if (!isCloudEvent(item)) {
							throw new Error('Failed to parse response item.');
						}

						return convertCloudEventToEvent(item, responseItemTexts[index]);
					});
				}),
		);
	}

	public readEvents(
		subject: string,
		options: ReadEventsOptions,
		signal?: AbortSignal,
	): AsyncGenerator<Event, void, void> {
		const url = this.#getUrl('/api/v1/read-events');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;

		return streamWithStallGuard({ stallTimeout, signal }, async function* (stallGuard) {
			const response = await stallGuard.send(url, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					subject,
					options,
				}),
			});

			const body = await getStreamBody(response, stallGuard, 'readEvents', 'read events');

			for await (const { value: line, text } of readNdJsonStream(
				body,
				stallGuard.signal,
				stallGuard,
			)) {
				if (isStreamError(line)) {
					throw createStreamError(line.payload.error);
				}
				if (isStreamCloudEvent(line)) {
					yield convertCloudEventToEvent(line.payload, getRawJsonMember(text, 'payload'));
					continue;
				}

				throw new Error('Failed to read events.');
			}
		});
	}

	public runEventQlQuery(query: string, signal?: AbortSignal): AsyncGenerator<unknown, void, void> {
		const url = this.#getUrl('/api/v1/run-eventql-query');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;

		return streamWithStallGuard({ stallTimeout, signal }, async function* (stallGuard) {
			const response = await stallGuard.send(url, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({ query }),
			});

			const body = await getStreamBody(
				response,
				stallGuard,
				'runEventQlQuery',
				'run EventQL query',
			);

			for await (const { value: line } of readNdJsonStream(body, stallGuard.signal, stallGuard)) {
				if (isStreamHeartbeat(line)) {
					continue;
				}
				if (isStreamError(line)) {
					throw createStreamError(line.payload.error);
				}
				if (isStreamRow(line)) {
					yield line.payload;
					continue;
				}

				throw new Error('Failed to run EventQL query.');
			}
		});
	}

	public observeEvents(
		subject: string,
		options: ObserveEventsOptions,
		signal?: AbortSignal,
	): AsyncGenerator<Event, void, void> {
		const url = this.#getUrl('/api/v1/observe-events');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;

		return streamWithStallGuard({ stallTimeout, signal }, async function* (stallGuard) {
			const response = await stallGuard.send(url, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					subject,
					options,
				}),
			});

			const body = await getStreamBody(response, stallGuard, 'observeEvents', 'observe events');

			for await (const { value: line, text } of readNdJsonStream(
				body,
				stallGuard.signal,
				stallGuard,
			)) {
				if (isStreamHeartbeat(line)) {
					continue;
				}
				if (isStreamError(line)) {
					throw createStreamError(line.payload.error);
				}
				if (isStreamCloudEvent(line)) {
					yield convertCloudEventToEvent(line.payload, getRawJsonMember(text, 'payload'));
					continue;
				}

				throw new Error('Failed to observe events.');
			}

			// Observing never ends on its own, so a stream that ends broke off,
			// unless the caller aborted it.
			stallGuard.throwIfStalled();
			if (!signal?.aborted) {
				throw createStreamEndedError('observe events');
			}
		});
	}

	public async registerEventSchema(
		eventType: string,
		schema: Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<void> {
		const url = this.#getUrl('/api/v1/register-event-schema');
		const stallTimeout = this.#stallTimeout;
		const body = JSON.stringify({
			eventType,
			schema,
		});

		await runWrite(
			{ signal, isRefusal: isV1Refusal },
			async () =>
				await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
					const response = await stallGuard.send(url, {
						method: 'POST',
						headers: {
							authorization: `Bearer ${this.#apiToken}`,
							'content-type': 'application/json',
						},
						body,
					});

					await assertOk(response, stallGuard, 'registerEventSchema');
				}),
		);
	}

	// The v1 API always reads the subjects below the subject as well. Reading
	// only the subject itself keeps the subject alone, which the server lists
	// at most once, so the request ends once it arrives. The server lists it
	// as it keeps it, so it is compared as the server keeps it, which makes
	// '/test/' keep '/test', as the v2 API does.
	public readSubjects(
		subject: string,
		{ recursive }: ReadSubjectsOptions,
		signal?: AbortSignal,
	): AsyncGenerator<string, void, void> {
		const url = this.#getUrl('/api/v1/read-subjects');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;
		const normalizedSubject = normalizeSubject(subject);

		return streamWithStallGuard({ stallTimeout, signal }, async function* (stallGuard) {
			const response = await stallGuard.send(url, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					baseSubject: subject,
				}),
			});

			const body = await getStreamBody(response, stallGuard, 'readSubjects', 'read subjects');

			for await (const { value: line } of readNdJsonStream(body, stallGuard.signal, stallGuard)) {
				if (isStreamError(line)) {
					throw createStreamError(line.payload.error);
				}
				if (isStreamSubject(line)) {
					if (recursive) {
						yield line.payload.subject;
						continue;
					}
					if (line.payload.subject === normalizedSubject) {
						yield line.payload.subject;
						return;
					}
					continue;
				}

				throw new Error('Failed to read subjects.');
			}
		});
	}

	public async readEventType(eventType: string, signal?: AbortSignal): Promise<EventType> {
		const url = this.#getUrl('/api/v1/read-event-type');
		const stallTimeout = this.#stallTimeout;

		return await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
			const response = await stallGuard.send(url, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${this.#apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					eventType,
				}),
			});

			await assertOk(response, stallGuard, 'readEventType');

			const responseBody: unknown = JSON.parse(await readResponseText(response, stallGuard));
			if (
				!hasShapeOf<V1EventType>(responseBody, {
					eventType: isString,
					isPhantom: isBoolean,
				})
			) {
				throw new Error('Failed to parse response.');
			}

			return toEventType(responseBody);
		});
	}

	public readEventTypes(signal?: AbortSignal): AsyncGenerator<EventType, void, void> {
		const url = this.#getUrl('/api/v1/read-event-types');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;

		return streamWithStallGuard({ stallTimeout, signal }, async function* (stallGuard) {
			const response = await stallGuard.send(url, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${apiToken}`,
				},
			});

			const body = await getStreamBody(response, stallGuard, 'readEventTypes', 'read event types');

			for await (const { value: line } of readNdJsonStream(body, stallGuard.signal, stallGuard)) {
				if (isStreamHeartbeat(line)) {
					continue;
				}
				if (isStreamError(line)) {
					throw createStreamError(line.payload.error);
				}
				if (isStreamEventType(line)) {
					yield toEventType(line.payload);
					continue;
				}

				throw new Error('Failed to read event types.');
			}
		});
	}
}

export { V1Transport };
