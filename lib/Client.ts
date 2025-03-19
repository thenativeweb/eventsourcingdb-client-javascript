import type { ClientConfiguration } from './ClientConfiguration.js';
import type { ClientOptions } from './ClientOptions.js';
import type { EventCandidate } from './event/EventCandidate.js';
import type { EventContext } from './event/EventContext.js';
import { getDefaultClientConfiguration } from './getDefaultClientConfiguration.js';
import type { StoreItem } from './handlers/StoreItem.js';
import type { ObserveEventsOptions } from './handlers/observeEvents/ObserveEventsOptions.js';
import { observeEvents } from './handlers/observeEvents/observeEvents.js';
import { ping } from './handlers/ping/ping.js';
import type { EventType } from './handlers/readEventTypes/EventType.js';
import { readEventTypes } from './handlers/readEventTypes/readEventTypes.js';
import type { ReadEventsOptions } from './handlers/readEvents/ReadEventsOptions.js';
import { readEvents } from './handlers/readEvents/readEvents.js';
import type { ReadSubjectsOptions } from './handlers/readSubjects/ReadSubjectsOptions.js';
import { readSubjects } from './handlers/readSubjects/readSubjects.js';
import { registerEventSchema } from './handlers/registerEventSchema/registerEventSchema.js';
import type { Precondition } from './handlers/writeEvents/Precondition.js';
import { writeEvents } from './handlers/writeEvents/writeEvents.js';
import { HttpClient } from './http/HttpClient.js';

class Client {
	public readonly configuration: ClientConfiguration;
	public readonly httpClient: HttpClient;

	public constructor(baseUrl: string, options: ClientOptions) {
		this.configuration = {
			...getDefaultClientConfiguration(baseUrl),
			...options,
		};
		this.httpClient = new HttpClient(this);
	}

	public observeEvents(
		abortController: AbortController,
		subject: string,
		options: ObserveEventsOptions,
	): AsyncGenerator<StoreItem, void, void> {
		return observeEvents(this, abortController, subject, options);
	}

	public async ping(): Promise<void> {
		await ping(this);
	}

	public readEvents(
		abortController: AbortController,
		subject: string,
		options: ReadEventsOptions,
	): AsyncGenerator<StoreItem, void, void> {
		return readEvents(this, abortController, subject, options);
	}

	public readEventTypes(abortController: AbortController): AsyncGenerator<EventType, void, void> {
		return readEventTypes(this, abortController);
	}

	public readSubjects(
		abortController: AbortController,
		options: ReadSubjectsOptions,
	): AsyncGenerator<string, void, void> {
		return readSubjects(this, abortController, options);
	}

	public async registerEventSchema(eventType: string, schema: string | object): Promise<void> {
		return await registerEventSchema(this, eventType, schema);
	}

	public async writeEvents(
		eventCandidates: EventCandidate[],
		preconditions: Precondition[] = [],
	): Promise<EventContext[]> {
		return await writeEvents(this, eventCandidates, preconditions);
	}
}

export { Client };
