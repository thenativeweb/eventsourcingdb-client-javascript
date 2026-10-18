import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import type { EventType } from './EventType.js';
import type { ObserveEventsOptions } from './ObserveEventsOptions.js';
import type { Precondition } from './Precondition.js';
import type { ReadEventsOptions } from './ReadEventsOptions.js';
import type { ReadSubjectsOptions } from './ReadSubjectsOptions.js';

// Sends the requests of a client through one API of the server. The client
// picks the transport for the API that the server offers.
interface Transport {
	ping: (signal?: AbortSignal) => Promise<void>;
	verifyApiToken: (signal?: AbortSignal) => Promise<void>;
	writeEvents: (
		events: EventCandidate[],
		preconditions: Precondition[],
		signal?: AbortSignal,
	) => Promise<Event[]>;
	readEvents: (
		subject: string,
		options: ReadEventsOptions,
		signal?: AbortSignal,
	) => AsyncGenerator<Event, void, void>;
	runEventQlQuery: (query: string, signal?: AbortSignal) => AsyncGenerator<unknown, void, void>;
	observeEvents: (
		subject: string,
		options: ObserveEventsOptions,
		signal?: AbortSignal,
	) => AsyncGenerator<Event, void, void>;
	registerEventSchema: (
		eventType: string,
		schema: Record<string, unknown>,
		signal?: AbortSignal,
	) => Promise<void>;
	readSubjects: (
		subject: string,
		options: ReadSubjectsOptions,
		signal?: AbortSignal,
	) => AsyncGenerator<string, void, void>;
	readEventType: (eventType: string, signal?: AbortSignal) => Promise<EventType>;
	readEventTypes: (signal?: AbortSignal) => AsyncGenerator<EventType, void, void>;
}

interface TransportOptions {
	url: URL;
	apiToken: string;
	stallTimeout: number;
}

export type { Transport, TransportOptions };
