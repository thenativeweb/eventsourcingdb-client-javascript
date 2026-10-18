import type { ClientOptions } from './ClientOptions.js';
import { convertCloudEventToEvent } from './convertCloudEventToEvent.js';
import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import type { EventType } from './EventType.js';
import { HeartbeatTimeoutError } from './HeartbeatTimeoutError.js';
import { isCloudEvent } from './isCloudEvent.js';
import { isValidServerHeader } from './isValidServerHeader.js';
import { getRawJsonElements } from './json/getRawJsonElements.js';
import { getRawJsonMember } from './json/getRawJsonMember.js';
import { readNdJsonStream } from './ndjson/readNdJsonStream.js';
import type { ObserveEventsOptions } from './ObserveEventsOptions.js';
import type { Precondition } from './Precondition.js';
import type { ReadEventsOptions } from './ReadEventsOptions.js';
import { defaultStallTimeout, maximumStallTimeout } from './stall/defaultStallTimeout.js';
import { readResponseText } from './stall/readResponseText.js';
import { runWithStallGuard } from './stall/runWithStallGuard.js';
import { StallGuard } from './stall/StallGuard.js';
import { isStreamCloudEvent } from './stream/isStreamCloudEvent.js';
import { isStreamError } from './stream/isStreamError.js';
import { isStreamEventType } from './stream/isStreamEventType.js';
import { isStreamHeartbeat } from './stream/isStreamHeartbeat.js';
import { isStreamRow } from './stream/isStreamRow.js';
import { isStreamSubject } from './stream/isStreamSubject.js';
import { hasShapeOf } from './types/hasShapeOf.js';
import { isBoolean } from './types/isBoolean.js';
import { isString } from './types/isString.js';

interface ResponseBodyPing {
	type: string;
}

interface ResponseBodyVerifyApiToken {
	type: string;
}

interface ResponseBodyReadEventType {
	eventType: string;
	isPhantom: boolean;
}

class Client {
	readonly #url: URL;
	readonly #apiToken: string;
	readonly #stallTimeout: number;

	#getUrl(path: string): string {
		return new URL(path, this.#url).toString();
	}

	public constructor(url: URL, apiToken: string, options: ClientOptions = {}) {
		const stallTimeout = options.stallTimeout ?? defaultStallTimeout;

		if (!(stallTimeout >= 1 && stallTimeout <= maximumStallTimeout)) {
			throw new Error(
				`Stall timeout must be between 1 and ${maximumStallTimeout} milliseconds, got '${stallTimeout}'.`,
			);
		}

		this.#url = url;
		this.#apiToken = apiToken;
		this.#stallTimeout = stallTimeout;
	}

	public async ping(signal?: AbortSignal): Promise<void> {
		const url = this.#getUrl('/api/v1/ping');
		const stallTimeout = this.#stallTimeout;

		await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
			const response = await fetch(url, {
				method: 'get',
				signal: stallGuard.signal,
			});

			if (!isValidServerHeader(response)) {
				throw new Error('Server must be EventSourcingDB.');
			}

			if (response.status !== 200) {
				throw new Error(
					`Failed to ping, got HTTP status code '${response.status}', expected '200'.`,
				);
			}

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
			const response = await fetch(url, {
				method: 'post',
				headers: {
					authorization: `Bearer ${this.#apiToken}`,
				},
				signal: stallGuard.signal,
			});

			if (!isValidServerHeader(response)) {
				throw new Error('Server must be EventSourcingDB.');
			}

			if (response.status !== 200) {
				throw new Error(
					`Failed to verify API token, got HTTP status code '${response.status}', expected '200'.`,
				);
			}

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
		preconditions: Precondition[] = [],
		signal?: AbortSignal,
	): Promise<Event[]> {
		const url = this.#getUrl('/api/v1/write-events');
		const stallTimeout = this.#stallTimeout;

		return await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
			const response = await fetch(url, {
				method: 'post',
				headers: {
					authorization: `Bearer ${this.#apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					events,
					preconditions,
				}),
				signal: stallGuard.signal,
			});

			if (!isValidServerHeader(response)) {
				throw new Error('Server must be EventSourcingDB.');
			}

			if (response.status !== 200) {
				throw new Error(
					`Failed to write events, got HTTP status code '${response.status}', expected '200'.`,
				);
			}

			const responseText = await readResponseText(response, stallGuard);
			const responseBody: unknown = JSON.parse(responseText);

			if (!Array.isArray(responseBody)) {
				throw new Error('Failed to parse response.');
			}

			const responseItemTexts = getRawJsonElements(responseText);

			const writtenEvents = responseBody.map((item: unknown, index) => {
				if (!isCloudEvent(item)) {
					throw new Error('Failed to parse response item.');
				}

				const event = convertCloudEventToEvent(item, responseItemTexts[index]);
				return event;
			});

			return writtenEvents;
		});
	}

	public readEvents(
		subject: string,
		options: ReadEventsOptions,
		signal?: AbortSignal,
	): AsyncGenerator<Event, void, void> {
		const url = this.#getUrl('/api/v1/read-events');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;

		return (async function* (): AsyncGenerator<Event, void, void> {
			const stallGuard = new StallGuard(stallTimeout, signal);

			try {
				stallGuard.restart();
				const response = await fetch(url, {
					method: 'post',
					headers: {
						authorization: `Bearer ${apiToken}`,
						'content-type': 'application/json',
					},
					body: JSON.stringify({
						subject,
						options,
					}),
					signal: stallGuard.signal,
				});

				if (!isValidServerHeader(response)) {
					const serverHeader = response.headers.get('Server');
					if (!serverHeader) {
						throw new Error('Server must be EventSourcingDB, but Server header is missing.');
					}
					throw new Error(`Server must be EventSourcingDB, got Server header: '${serverHeader}'.`);
				}

				if (response.status !== 200) {
					throw new Error(
						`Failed to read events, got HTTP status code '${response.status}', expected '200'.`,
					);
				}
				if (!response.body) {
					throw new Error('Failed to read events.');
				}

				for await (const { value: line, text } of readNdJsonStream(
					response.body,
					stallGuard.signal,
					stallGuard,
				)) {
					if (isStreamError(line)) {
						throw new Error(`${line.payload.error}.`);
					}
					if (isStreamCloudEvent(line)) {
						const event = convertCloudEventToEvent(line.payload, getRawJsonMember(text, 'payload'));
						yield event;
						continue;
					}

					throw new Error('Failed to read events.');
				}

				stallGuard.throwIfStalled();
			} catch (error) {
				stallGuard.throwIfStalled();

				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}
				throw error;
			} finally {
				stallGuard.dispose({ abortRequest: true });
			}
		})();
	}

	public runEventQlQuery(query: string, signal?: AbortSignal): AsyncGenerator<unknown, void, void> {
		const url = this.#getUrl('/api/v1/run-eventql-query');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;

		return (async function* (): AsyncGenerator<unknown, void, void> {
			const stallGuard = new StallGuard(stallTimeout, signal);

			try {
				stallGuard.restart();
				const response = await fetch(url, {
					method: 'post',
					headers: {
						authorization: `Bearer ${apiToken}`,
						'content-type': 'application/json',
					},
					body: JSON.stringify({ query }),
					signal: stallGuard.signal,
				});

				// Once the headers have arrived, the server sends a heartbeat every
				// second, so from now on a stall means that heartbeats are missing.
				stallGuard.onStall(() => new HeartbeatTimeoutError(stallTimeout));

				if (!isValidServerHeader(response)) {
					const serverHeader = response.headers.get('Server');
					if (!serverHeader) {
						throw new Error('Server must be EventSourcingDB, but Server header is missing.');
					}
					throw new Error(`Server must be EventSourcingDB, got Server header: '${serverHeader}'.`);
				}

				if (response.status !== 200) {
					throw new Error(
						`Failed to run EventQL query, got HTTP status code '${response.status}', expected '200'.`,
					);
				}
				if (!response.body) {
					throw new Error('Failed to run EventQL query.');
				}

				for await (const { value: line } of readNdJsonStream(
					response.body,
					stallGuard.signal,
					stallGuard,
				)) {
					if (isStreamHeartbeat(line)) {
						continue;
					}
					if (isStreamError(line)) {
						throw new Error(`${line.payload.error}.`);
					}
					if (isStreamRow(line)) {
						const row = line.payload;
						yield row;
						continue;
					}

					throw new Error('Failed to run EventQL query.');
				}

				stallGuard.throwIfStalled();
			} catch (error) {
				stallGuard.throwIfStalled();

				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}
				throw error;
			} finally {
				stallGuard.dispose({ abortRequest: true });
			}
		})();
	}

	public observeEvents(
		subject: string,
		options: ObserveEventsOptions,
		signal?: AbortSignal,
	): AsyncGenerator<Event, void, void> {
		const url = this.#getUrl('/api/v1/observe-events');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;

		return (async function* (): AsyncGenerator<Event, void, void> {
			const stallGuard = new StallGuard(stallTimeout, signal);

			try {
				stallGuard.restart();
				const response = await fetch(url, {
					method: 'post',
					headers: {
						authorization: `Bearer ${apiToken}`,
						'content-type': 'application/json',
					},
					body: JSON.stringify({
						subject,
						options,
					}),
					signal: stallGuard.signal,
				});

				// Once the headers have arrived, the server sends a heartbeat every
				// second, so from now on a stall means that heartbeats are missing.
				stallGuard.onStall(() => new HeartbeatTimeoutError(stallTimeout));

				if (!isValidServerHeader(response)) {
					const serverHeader = response.headers.get('Server');
					if (!serverHeader) {
						throw new Error('Server must be EventSourcingDB, but Server header is missing.');
					}
					throw new Error(`Server must be EventSourcingDB, got Server header: '${serverHeader}'.`);
				}

				if (response.status !== 200) {
					throw new Error(
						`Failed to observe events, got HTTP status code '${response.status}', expected '200'.`,
					);
				}
				if (!response.body) {
					throw new Error('Failed to observe events.');
				}

				for await (const { value: line, text } of readNdJsonStream(
					response.body,
					stallGuard.signal,
					stallGuard,
				)) {
					if (isStreamHeartbeat(line)) {
						continue;
					}
					if (isStreamError(line)) {
						throw new Error(`${line.payload.error}.`);
					}
					if (isStreamCloudEvent(line)) {
						const event = convertCloudEventToEvent(line.payload, getRawJsonMember(text, 'payload'));
						yield event;
						continue;
					}

					throw new Error('Failed to observe events.');
				}

				stallGuard.throwIfStalled();
			} catch (error) {
				stallGuard.throwIfStalled();

				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}
				throw error;
			} finally {
				stallGuard.dispose({ abortRequest: true });
			}
		})();
	}

	public async registerEventSchema(
		eventType: string,
		schema: Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<void> {
		const url = this.#getUrl('/api/v1/register-event-schema');
		const stallTimeout = this.#stallTimeout;

		await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
			const response = await fetch(url, {
				method: 'post',
				headers: {
					authorization: `Bearer ${this.#apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					eventType,
					schema,
				}),
				signal: stallGuard.signal,
			});

			if (!isValidServerHeader(response)) {
				throw new Error('Server must be EventSourcingDB.');
			}

			if (response.status !== 200) {
				throw new Error(
					`Failed to register event schema, got HTTP status code '${response.status}', expected '200'.`,
				);
			}
		});
	}

	public readSubjects(
		baseSubject: string,
		signal?: AbortSignal,
	): AsyncGenerator<string, void, void> {
		const url = this.#getUrl('/api/v1/read-subjects');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;

		return (async function* (): AsyncGenerator<string, void, void> {
			const stallGuard = new StallGuard(stallTimeout, signal);

			try {
				stallGuard.restart();
				const response = await fetch(url, {
					method: 'post',
					headers: {
						authorization: `Bearer ${apiToken}`,
						'content-type': 'application/json',
					},
					body: JSON.stringify({
						baseSubject,
					}),
					signal: stallGuard.signal,
				});

				if (!isValidServerHeader(response)) {
					const serverHeader = response.headers.get('Server');
					if (!serverHeader) {
						throw new Error('Server must be EventSourcingDB, but Server header is missing.');
					}
					throw new Error(`Server must be EventSourcingDB, got Server header: '${serverHeader}'.`);
				}

				if (response.status !== 200) {
					throw new Error(
						`Failed to read subjects, got HTTP status code '${response.status}', expected '200'.`,
					);
				}
				if (!response.body) {
					throw new Error('Failed to read subjects.');
				}

				for await (const { value: line } of readNdJsonStream(
					response.body,
					stallGuard.signal,
					stallGuard,
				)) {
					if (isStreamError(line)) {
						throw new Error(`${line.payload.error}.`);
					}
					if (isStreamSubject(line)) {
						yield line.payload.subject;
						continue;
					}

					throw new Error('Failed to read subjects.');
				}

				stallGuard.throwIfStalled();
			} catch (error) {
				stallGuard.throwIfStalled();

				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}
				throw error;
			} finally {
				stallGuard.dispose({ abortRequest: true });
			}
		})();
	}

	public async readEventType(eventType: string, signal?: AbortSignal): Promise<EventType> {
		const url = this.#getUrl('/api/v1/read-event-type');
		const stallTimeout = this.#stallTimeout;

		return await runWithStallGuard({ stallTimeout, signal }, async stallGuard => {
			const response = await fetch(url, {
				method: 'post',
				headers: {
					authorization: `Bearer ${this.#apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					eventType,
				}),
				signal: stallGuard.signal,
			});

			if (!isValidServerHeader(response)) {
				throw new Error('Server must be EventSourcingDB.');
			}

			if (response.status !== 200) {
				throw new Error(
					`Failed to read event type, got HTTP status code '${response.status}', expected '200'.`,
				);
			}
			const responseBody: unknown = JSON.parse(await readResponseText(response, stallGuard));
			if (
				!hasShapeOf<ResponseBodyReadEventType>(responseBody, {
					eventType: isString,
					isPhantom: isBoolean,
				})
			) {
				throw new Error('Failed to parse response.');
			}

			return responseBody;
		});
	}

	public readEventTypes(signal?: AbortSignal): AsyncGenerator<EventType, void, void> {
		const url = this.#getUrl('/api/v1/read-event-types');
		const apiToken = this.#apiToken;
		const stallTimeout = this.#stallTimeout;

		return (async function* (): AsyncGenerator<EventType, void, void> {
			const stallGuard = new StallGuard(stallTimeout, signal);

			try {
				stallGuard.restart();
				const response = await fetch(url, {
					method: 'post',
					headers: {
						authorization: `Bearer ${apiToken}`,
					},
					signal: stallGuard.signal,
				});

				if (!isValidServerHeader(response)) {
					const serverHeader = response.headers.get('Server');
					if (!serverHeader) {
						throw new Error('Server must be EventSourcingDB, but Server header is missing.');
					}
					throw new Error(`Server must be EventSourcingDB, got Server header: '${serverHeader}'.`);
				}

				if (response.status !== 200) {
					throw new Error(
						`Failed to read event types, got HTTP status code '${response.status}', expected '200'.`,
					);
				}
				if (!response.body) {
					throw new Error('Failed to read event types.');
				}

				for await (const { value: line } of readNdJsonStream(
					response.body,
					stallGuard.signal,
					stallGuard,
				)) {
					if (isStreamHeartbeat(line)) {
						continue;
					}
					if (isStreamError(line)) {
						throw new Error(`${line.payload.error}.`);
					}
					if (isStreamEventType(line)) {
						yield line.payload;
						continue;
					}

					throw new Error('Failed to read event types.');
				}

				stallGuard.throwIfStalled();
			} catch (error) {
				stallGuard.throwIfStalled();

				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}
				throw error;
			} finally {
				stallGuard.dispose({ abortRequest: true });
			}
		})();
	}
}

export { Client };
