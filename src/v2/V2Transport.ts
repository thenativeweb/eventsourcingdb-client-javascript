import type { Event } from '../Event.js';
import type { EventCandidate } from '../EventCandidate.js';
import type { EventType } from '../EventType.js';
import { createStreamEndedError } from '../http/createStreamEndedError.js';
import { runWrite } from '../http/runWrite.js';
import type { ObserveEventsOptions } from '../ObserveEventsOptions.js';
import type { Precondition } from '../Precondition.js';
import type { ReadEventsOptions } from '../ReadEventsOptions.js';
import type { ReadSubjectsOptions } from '../ReadSubjectsOptions.js';
import { runWithStallGuard } from '../stall/runWithStallGuard.js';
import type { StallGuard } from '../stall/StallGuard.js';
import { streamWithStallGuard } from '../stall/streamWithStallGuard.js';
import type { Transport, TransportOptions } from '../Transport.js';
import { hasShapeOf } from '../types/hasShapeOf.js';
import { isRecord } from '../types/isRecord.js';
import { isString } from '../types/isString.js';
import { convertV2ItemToEvent, convertV2ItemToEventType } from './convertV2Item.js';
import { isV2Refusal } from './isV2Refusal.js';
import { readV2Answer } from './readV2Answer.js';
import { readV2Stream } from './readV2Stream.js';
import { toObserveEventsBody, toReadEventsBody, toWriteEventsBody } from './toV2RequestBody.js';
import type { V2Item } from './V2Item.js';

// The v2 API reads with the method QUERY of RFC 10008, which, unlike GET,
// carries a body.
const methodQuery = 'QUERY';

interface EventOfType {
	type: string;
}

const isEventOfType = (item: V2Item, eventType: string): boolean =>
	item.type === 'event' &&
	hasShapeOf<EventOfType>(item.data, {
		type: isString,
	}) &&
	item.data.type === eventType;

// Reads the answer of a write, a stream that closes with an end item once the
// write is done, and returns its items before that. Only an abort of the
// caller ends it early without failing, which then fails with the reason of
// the abort, since the write may have been stored nonetheless.
const readWriteAnswer = async (
	response: Response,
	stallGuard: StallGuard,
	{
		signal,
		action,
		forgetApiVersion,
	}: { signal?: AbortSignal; action: string; forgetApiVersion: () => void },
): Promise<V2Item[]> => {
	const items: V2Item[] = [];

	for await (const item of readV2Stream(response, stallGuard, {
		signal,
		action,
		hasEnd: true,
		forgetApiVersion,
	})) {
		if (item.type === 'end') {
			return items;
		}

		items.push(item);
	}

	signal?.throwIfAborted();
	throw createStreamEndedError(action);
};

interface V2TransportOptions extends TransportOptions {
	// Tells the client to forget which API the server offers, once the server
	// answers as one that does not offer the v2 API.
	forgetApiVersion: () => void;
}

// Sends the requests through the v2 API, which EventSourcingDB offers since
// version 1.3.
class V2Transport implements Transport {
	readonly #url: URL;
	readonly #apiToken: string;
	readonly #stallTimeout: number;
	readonly #forgetApiVersion: () => void;

	#getUrl(path: string): string {
		return new URL(path, this.#url).toString();
	}

	public constructor({ url, apiToken, stallTimeout, forgetApiVersion }: V2TransportOptions) {
		this.#url = url;
		this.#apiToken = apiToken;
		this.#stallTimeout = stallTimeout;
		this.#forgetApiVersion = forgetApiVersion;
	}

	public async ping(signal?: AbortSignal): Promise<void> {
		const url = this.#getUrl('/api/v2/system/ping');
		const stallTimeout = this.#stallTimeout;

		await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
			const response = await stallGuard.send(url, {
				method: 'GET',
			});

			const item = await readV2Answer(response, stallGuard, {
				action: 'ping',
				forgetApiVersion: this.#forgetApiVersion,
			});
			if (!isEventOfType(item, 'io.eventsourcingdb.api.ping-received')) {
				throw new Error('Failed to ping.');
			}
		});
	}

	public async verifyApiToken(signal?: AbortSignal): Promise<void> {
		const url = this.#getUrl('/api/v2/system/verify-token');
		const stallTimeout = this.#stallTimeout;

		await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
			const response = await stallGuard.send(url, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${this.#apiToken}`,
				},
			});

			const item = await readV2Answer(response, stallGuard, {
				action: 'verify API token',
				forgetApiVersion: this.#forgetApiVersion,
			});
			if (!isEventOfType(item, 'io.eventsourcingdb.api.token-verified')) {
				throw new Error('Failed to verify API token.');
			}
		});
	}

	public async writeEvents(
		events: EventCandidate[],
		preconditions: Precondition[],
		signal?: AbortSignal,
	): Promise<Event[]> {
		const url = this.#getUrl('/api/v2/data/write-events');
		const stallTimeout = this.#stallTimeout;
		const body = JSON.stringify(toWriteEventsBody(events, preconditions));
		const action = 'write events';

		return await runWrite(
			{ signal, isRefusal: isV2Refusal },
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

					const items = await readWriteAnswer(response, stallGuard, {
						signal,
						action,
						forgetApiVersion: this.#forgetApiVersion,
					});

					return items.map(item => {
						if (item.type !== 'event') {
							throw new Error(`Failed to ${action}, got an unexpected item.`);
						}

						return convertV2ItemToEvent(item, action);
					});
				}),
		);
	}

	public readEvents(
		subject: string,
		options: ReadEventsOptions,
		signal?: AbortSignal,
	): AsyncGenerator<Event, void, void> {
		const url = this.#getUrl('/api/v2/data/read-events');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;
		const forgetApiVersion = this.#forgetApiVersion;
		const action = 'read events';

		return streamWithStallGuard({ stallTimeout, signal }, async function* (stallGuard) {
			const response = await stallGuard.send(url, {
				method: methodQuery,
				headers: {
					authorization: `Bearer ${apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify(toReadEventsBody(subject, options)),
			});

			for await (const item of readV2Stream(response, stallGuard, {
				signal,
				action,
				hasEnd: true,
				forgetApiVersion,
			})) {
				if (item.type === 'end') {
					return;
				}
				if (item.type === 'event') {
					yield convertV2ItemToEvent(item, action);
					continue;
				}

				throw new Error(`Failed to ${action}, got an unexpected item.`);
			}
		});
	}

	public runEventQlQuery(query: string, signal?: AbortSignal): AsyncGenerator<unknown, void, void> {
		const url = this.#getUrl('/api/v2/data/run-eventql-query');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;
		const forgetApiVersion = this.#forgetApiVersion;
		const action = 'run EventQL query';

		return streamWithStallGuard({ stallTimeout, signal }, async function* (stallGuard) {
			const response = await stallGuard.send(url, {
				method: methodQuery,
				headers: {
					authorization: `Bearer ${apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({ query }),
			});

			for await (const item of readV2Stream(response, stallGuard, {
				signal,
				action,
				hasEnd: true,
				forgetApiVersion,
			})) {
				if (item.type === 'end') {
					return;
				}
				// A row wraps its value, which may be any JSON value, null included.
				if (item.type === 'row' && isRecord(item.data) && 'value' in item.data) {
					yield item.data.value;
					continue;
				}

				throw new Error(`Failed to ${action}, got an unexpected item.`);
			}
		});
	}

	// Observing never ends on its own, so its stream has no end item, and fails
	// if it ends nonetheless.
	public observeEvents(
		subject: string,
		options: ObserveEventsOptions,
		signal?: AbortSignal,
	): AsyncGenerator<Event, void, void> {
		const url = this.#getUrl('/api/v2/data/observe-events');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;
		const forgetApiVersion = this.#forgetApiVersion;
		const action = 'observe events';

		return streamWithStallGuard({ stallTimeout, signal }, async function* (stallGuard) {
			const response = await stallGuard.send(url, {
				method: methodQuery,
				headers: {
					authorization: `Bearer ${apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify(toObserveEventsBody(subject, options)),
			});

			for await (const item of readV2Stream(response, stallGuard, {
				signal,
				action,
				hasEnd: false,
				forgetApiVersion,
			})) {
				if (item.type === 'event') {
					yield convertV2ItemToEvent(item, action);
					continue;
				}

				throw new Error(`Failed to ${action}, got an unexpected item.`);
			}
		});
	}

	public async registerEventSchema(
		eventType: string,
		schema: Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<void> {
		const url = this.#getUrl('/api/v2/data/register-event-schema');
		const stallTimeout = this.#stallTimeout;
		const body = JSON.stringify({
			type: eventType,
			schema,
		});
		const action = 'register event schema';

		await runWrite(
			{ signal, isRefusal: isV2Refusal },
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

					const items = await readWriteAnswer(response, stallGuard, {
						signal,
						action,
						forgetApiVersion: this.#forgetApiVersion,
					});

					const [item, ...otherItems] = items;
					if (
						item === undefined ||
						otherItems.length > 0 ||
						!isEventOfType(item, 'io.eventsourcingdb.api.event-schema-registered')
					) {
						throw new Error(`Failed to ${action}, got an unexpected answer.`);
					}
				}),
		);
	}

	public readSubjects(
		subject: string,
		{ recursive }: ReadSubjectsOptions,
		signal?: AbortSignal,
	): AsyncGenerator<string, void, void> {
		const url = this.#getUrl('/api/v2/data/read-subjects');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;
		const forgetApiVersion = this.#forgetApiVersion;
		const action = 'read subjects';

		return streamWithStallGuard({ stallTimeout, signal }, async function* (stallGuard) {
			const response = await stallGuard.send(url, {
				method: methodQuery,
				headers: {
					authorization: `Bearer ${apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					subject,
					options: { recursive },
				}),
			});

			for await (const item of readV2Stream(response, stallGuard, {
				signal,
				action,
				hasEnd: true,
				forgetApiVersion,
			})) {
				if (item.type === 'end') {
					return;
				}
				if (item.type === 'subject' && isRecord(item.data) && isString(item.data.subject)) {
					yield item.data.subject;
					continue;
				}

				throw new Error(`Failed to ${action}, got an unexpected item.`);
			}
		});
	}

	public async readEventType(eventType: string, signal?: AbortSignal): Promise<EventType> {
		const url = this.#getUrl('/api/v2/data/read-event-type');
		const stallTimeout = this.#stallTimeout;
		const action = 'read event type';

		return await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
			const response = await stallGuard.send(url, {
				method: methodQuery,
				headers: {
					authorization: `Bearer ${this.#apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					type: eventType,
				}),
			});

			const item = await readV2Answer(response, stallGuard, {
				action,
				forgetApiVersion: this.#forgetApiVersion,
			});
			if (item.type !== 'eventType') {
				throw new Error(`Failed to ${action}, got an unexpected answer.`);
			}

			return convertV2ItemToEventType(item, action);
		});
	}

	public readEventTypes(signal?: AbortSignal): AsyncGenerator<EventType, void, void> {
		const url = this.#getUrl('/api/v2/data/read-event-types');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;
		const forgetApiVersion = this.#forgetApiVersion;
		const action = 'read event types';

		return streamWithStallGuard({ stallTimeout, signal }, async function* (stallGuard) {
			const response = await stallGuard.send(url, {
				method: methodQuery,
				headers: {
					authorization: `Bearer ${apiToken}`,
				},
			});

			for await (const item of readV2Stream(response, stallGuard, {
				signal,
				action,
				hasEnd: true,
				forgetApiVersion,
			})) {
				if (item.type === 'end') {
					return;
				}
				if (item.type === 'eventType') {
					yield convertV2ItemToEventType(item, action);
					continue;
				}

				throw new Error(`Failed to ${action}, got an unexpected item.`);
			}
		});
	}
}

export { V2Transport };
