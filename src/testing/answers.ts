import type { ApiVersion } from '../detectApiVersion.js';
import { toLine } from './FakeServer.js';

// The items and answers of both APIs as EventSourcingDB sends them, for tests
// that run against a fake server.

const getCloudEvent = (id: string): Record<string, unknown> => ({
	specversion: '1.0',
	id,
	time: '2026-10-03T12:00:00.000Z',
	source: 'https://www.eventsourcingdb.io',
	subject: '/test',
	type: 'io.eventsourcingdb.test',
	datacontenttype: 'application/json',
	data: { value: 23 },
	hash: 'hash',
	predecessorhash: 'predecessorhash',
	signature: null,
});

// The v2 API sends an absent trace context as null.
const getV2Event = (id: string): Record<string, unknown> => ({
	...getCloudEvent(id),
	traceparent: null,
	tracestate: null,
});

interface Lines {
	event: (id: string) => string;
	row: (value: unknown) => string;
	subject: (subject: string) => string;
	eventType: (eventType: string) => string;
	heartbeat: string;
	error: (description: string) => string;

	// The end item of a finite stream, which the v1 API does not have.
	end: string;
}

const lines: Record<ApiVersion, Lines> = {
	v1: {
		event: (id: string): string => toLine({ type: 'event', payload: getCloudEvent(id) }),
		row: (value: unknown): string => toLine({ type: 'row', payload: value }),
		subject: (subject: string): string => toLine({ type: 'subject', payload: { subject } }),
		eventType: (eventType: string): string =>
			toLine({ type: 'eventType', payload: { eventType, isPhantom: false } }),
		heartbeat: toLine({ type: 'heartbeat', payload: {} }),
		error: (description: string): string =>
			toLine({ type: 'error', payload: { error: description } }),
		end: '',
	},
	v2: {
		event: (id: string): string => toLine({ type: 'event', data: getV2Event(id) }),
		row: (value: unknown): string => toLine({ type: 'row', data: { value } }),
		subject: (subject: string): string => toLine({ type: 'subject', data: { subject } }),
		eventType: (eventType: string): string =>
			toLine({ type: 'eventType', data: { type: eventType, hasEvents: true, schema: null } }),
		heartbeat: toLine({ type: 'heartbeat', data: {} }),
		error: (description: string): string =>
			toLine({
				type: 'error',
				data: {
					code: 'https://docs.eventsourcingdb.io/errors/store-read-only',
					description,
					details: {},
				},
			}),
		end: toLine({ type: 'end', data: {} }),
	},
};

const getV2SystemEvent = (type: string, subject: string): Record<string, unknown> => ({
	specversion: '1.0',
	id: '0',
	source: 'https://www.eventsourcingdb.io',
	subject,
	type,
	time: '2026-10-03T12:00:00.000Z',
	datacontenttype: 'application/json',
	data: {},
});

interface Answer {
	contentType: string;
	body: string;
}

// The answers to the requests that have a single answer, or whose answer the
// client reads as a whole, if it reads one at all.
interface Answers {
	ping: Answer;
	verifyApiToken: Answer;
	writeEvents: Answer;
	registerEventSchema?: Answer;
	readEventType: Answer;
}

const json = 'application/json';
const ndJson = 'application/x-ndjson';

const answers: Record<ApiVersion, Answers> = {
	v1: {
		ping: { contentType: json, body: '{"type":"io.eventsourcingdb.api.ping-received"}' },
		verifyApiToken: {
			contentType: json,
			body: '{"type":"io.eventsourcingdb.api.api-token-verified"}',
		},
		writeEvents: { contentType: json, body: JSON.stringify([getCloudEvent('0')]) },
		readEventType: {
			contentType: json,
			body: '{"eventType":"io.eventsourcingdb.test","isPhantom":false}',
		},
	},
	v2: {
		ping: {
			contentType: json,
			body: JSON.stringify({
				type: 'event',
				data: getV2SystemEvent('io.eventsourcingdb.api.ping-received', '/api/v2/system/ping'),
			}),
		},
		verifyApiToken: {
			contentType: json,
			body: JSON.stringify({
				type: 'event',
				data: getV2SystemEvent(
					'io.eventsourcingdb.api.token-verified',
					'/api/v2/system/verify-token',
				),
			}),
		},
		writeEvents: { contentType: ndJson, body: `${lines.v2.event('0')}${lines.v2.end}` },
		registerEventSchema: {
			contentType: ndJson,
			body: `${toLine({
				type: 'event',
				data: getV2SystemEvent(
					'io.eventsourcingdb.api.event-schema-registered',
					'/api/v2/data/register-event-schema',
				),
			})}${lines.v2.end}`,
		},
		readEventType: {
			contentType: json,
			body: JSON.stringify({
				type: 'eventType',
				data: { type: 'io.eventsourcingdb.test', hasEvents: true, schema: null },
			}),
		},
	},
};

const apiVersions: ApiVersion[] = ['v1', 'v2'];

export type { Answer };
export { answers, apiVersions, lines };
