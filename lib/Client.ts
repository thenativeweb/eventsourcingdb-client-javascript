import { ClientConfiguration } from './ClientConfiguration';
import { getDefaultClientConfiguration } from './getDefaultClientConfiguration';
import { observeEvents } from './handlers/observeEvents/observeEvents';
import { ObserveEventsOptions } from './handlers/observeEvents/ObserveEventsOptions';
import { readEvents } from './handlers/readEvents/readEvents';
import { ReadEventsOptions } from './handlers/readEvents/ReadEventsOptions';
import { StoreItem } from './handlers/StoreItem';
import { EventCandidate } from './event/EventCandidate';
import { ping } from './handlers/ping/ping';
import { writeEvents } from './handlers/writeEvents/writeEvents';
import { EventContext } from './event/EventContext';
import { Precondition } from './handlers/writeEvents/Precondition';
import { ClientOptions } from './ClientOptions';
import { HttpClient } from './http/HttpClient';
import { ReadSubjectsOptions } from './handlers/readSubjects/ReadSubjectsOptions';
import { readSubjects } from './handlers/readSubjects/readSubjects';

class Client {
	public readonly configuration: ClientConfiguration;
	public readonly httpClient: HttpClient;

	public constructor(baseUrl: string, options?: ClientOptions) {
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

	public readSubjects(
		abortController: AbortController,
		options: ReadSubjectsOptions,
	): AsyncGenerator<string, void, void> {
		return readSubjects(this, abortController, options);
	}

	public async writeEvents(
		eventCandidates: EventCandidate[],
		preconditions: Precondition[] = [],
	): Promise<EventContext[]> {
		return writeEvents(this, eventCandidates, preconditions);
	}
}

export { Client };
