import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import type { EventType } from './EventType.js';
import type { ObserveEventsOptions } from './ObserveEventsOptions.js';
import type { Precondition } from './Precondition.js';
import type { ReadEventsOptions } from './ReadEventsOptions.js';
import { convertCloudEventToEvent } from './convertCloudEventToEvent.js';
import { isCloudEvent } from './isCloudEvent.js';
import { readNdJsonStream } from './ndjson/readNdJsonStream.js';
import { isStreamCloudEvent } from './stream/isStreamCloudEvent.js';
import { isStreamError } from './stream/isStreamError.js';
import { isStreamEventType } from './stream/isStreamEventType.js';
import { isStreamHeartbeat } from './stream/isStreamHeartbeat.js';
import { isStreamSubject } from './stream/isStreamSubject.js';
import { hasShapeOf } from './types/hasShapeOf.js';

class Client {
	#url: URL;
	#apiToken: string;

	#getUrl(path: string): string {
		return new URL(path, this.#url).toString();
	}

	public constructor(url: URL, apiToken: string) {
		this.#url = url;
		this.#apiToken = apiToken;
	}

	public async ping(): Promise<void> {
		const url = this.#getUrl('/api/v1/ping');
		const response = await fetch(url, {
			method: 'get',
		});

		if (response.status !== 200) {
			throw new Error(`Failed to ping, got HTTP status code '${response.status}', expected '200'.`);
		}

		const responseBody = await response.json();
		if (!hasShapeOf(responseBody, { type: 'string' })) {
			throw new Error('Failed to parse response.');
		}

		const eventType = 'io.eventsourcingdb.api.ping-received';
		if (responseBody.type !== eventType) {
			throw new Error('Failed to ping.');
		}
	}

	public async verifyApiToken(): Promise<void> {
		const url = this.#getUrl('/api/v1/verify-api-token');
		const response = await fetch(url, {
			method: 'post',
			headers: {
				authorization: `Bearer ${this.#apiToken}`,
			},
		});

		if (response.status !== 200) {
			throw new Error(
				`Failed to verify API token, got HTTP status code '${response.status}', expected '200'.`,
			);
		}

		const responseBody = await response.json();
		if (!hasShapeOf(responseBody, { type: 'string' })) {
			throw new Error('Failed to parse response.');
		}

		const eventType = 'io.eventsourcingdb.api.api-token-verified';
		if (responseBody.type !== eventType) {
			throw new Error('Failed to verify API token.');
		}
	}

	public async writeEvents(
		events: EventCandidate[],
		preconditions: Precondition[] = [],
	): Promise<Event[]> {
		const url = this.#getUrl('/api/v1/write-events');
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
		});

		if (response.status !== 200) {
			throw new Error(
				`Failed to write events, got HTTP status code '${response.status}', expected '200'.`,
			);
		}

		const responseBody = await response.json();

		if (!Array.isArray(responseBody)) {
			throw new Error('Failed to parse response.');
		}

		const writtenEvents = responseBody.map(item => {
			if (!isCloudEvent(item)) {
				throw new Error('Failed to parse response item.');
			}

			const event = convertCloudEventToEvent(item);
			return event;
		});

		return writtenEvents;
	}

	public readEvents(
		subject: string,
		options: ReadEventsOptions,
	): AsyncGenerator<Event, void, void> {
		const url = this.#getUrl('/api/v1/read-events');
		const apiToken = this.#apiToken;

		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The complexity is fine here.
		return (async function* () {
			const abortController = new AbortController();

			try {
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
					signal: abortController.signal,
				});

				if (response.status !== 200) {
					throw new Error(
						`Failed to read events, got HTTP status code '${response.status}', expected '200'.`,
					);
				}
				if (!response.body) {
					throw new Error('Failed to read events.');
				}

				for await (const line of readNdJsonStream(response.body)) {
					if (isStreamHeartbeat(line)) {
						continue;
					}
					if (isStreamError(line)) {
						throw new Error(`${line.payload.error}.`);
					}
					if (isStreamCloudEvent(line)) {
						const event = convertCloudEventToEvent(line.payload);
						yield event;
						continue;
					}

					throw new Error('Failed to read events.');
				}
			} finally {
				abortController.abort();
			}
		})();
	}

	public observeEvents(
		subject: string,
		options: ObserveEventsOptions,
	): AsyncGenerator<Event, void, void> {
		const url = this.#getUrl('/api/v1/observe-events');
		const apiToken = this.#apiToken;

		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The complexity is fine here.
		return (async function* () {
			const abortController = new AbortController();

			try {
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
					signal: abortController.signal,
				});

				if (response.status !== 200) {
					throw new Error(
						`Failed to observe events, got HTTP status code '${response.status}', expected '200'.`,
					);
				}
				if (!response.body) {
					throw new Error('Failed to observe events.');
				}

				for await (const line of readNdJsonStream(response.body)) {
					if (isStreamHeartbeat(line)) {
						continue;
					}
					if (isStreamError(line)) {
						throw new Error(`${line.payload.error}.`);
					}
					if (isStreamCloudEvent(line)) {
						const event = convertCloudEventToEvent(line.payload);
						yield event;
						continue;
					}

					throw new Error('Failed to observe events.');
				}
			} finally {
				abortController.abort();
			}
		})();
	}

	public async registerEventSchema(
		eventType: string,
		schema: Record<string, unknown>,
	): Promise<void> {
		const url = this.#getUrl('/api/v1/register-event-schema');
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
		});

		if (response.status !== 200) {
			throw new Error(
				`Failed to register event schema, got HTTP status code '${response.status}', expected '200'.`,
			);
		}
	}

	public readSubjects(baseSubject: string): AsyncGenerator<string, void, void> {
		const url = this.#getUrl('/api/v1/read-subjects');
		const apiToken = this.#apiToken;

		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The complexity is fine here.
		return (async function* () {
			const abortController = new AbortController();

			try {
				const response = await fetch(url, {
					method: 'post',
					headers: {
						authorization: `Bearer ${apiToken}`,
						'content-type': 'application/json',
					},
					body: JSON.stringify({
						baseSubject,
					}),
					signal: abortController.signal,
				});

				if (response.status !== 200) {
					throw new Error(
						`Failed to read subjects, got HTTP status code '${response.status}', expected '200'.`,
					);
				}
				if (!response.body) {
					throw new Error('Failed to read subjects.');
				}

				for await (const line of readNdJsonStream(response.body)) {
					if (isStreamHeartbeat(line)) {
						continue;
					}
					if (isStreamError(line)) {
						throw new Error(`${line.payload.error}.`);
					}
					if (isStreamSubject(line)) {
						yield line.payload.subject;
						continue;
					}

					throw new Error('Failed to read subjects.');
				}
			} finally {
				abortController.abort();
			}
		})();
	}

	public readEventTypes(): AsyncGenerator<EventType, void, void> {
		const url = this.#getUrl('/api/v1/read-event-types');
		const apiToken = this.#apiToken;

		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The complexity is fine here.
		return (async function* () {
			const abortController = new AbortController();

			try {
				const response = await fetch(url, {
					method: 'post',
					headers: {
						authorization: `Bearer ${apiToken}`,
					},
					signal: abortController.signal,
				});

				if (response.status !== 200) {
					throw new Error(
						`Failed to read event types, got HTTP status code '${response.status}', expected '200'.`,
					);
				}
				if (!response.body) {
					throw new Error('Failed to read event types.');
				}

				for await (const line of readNdJsonStream(response.body)) {
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
			} finally {
				abortController.abort();
			}
		})();
	}
}

export { Client };
