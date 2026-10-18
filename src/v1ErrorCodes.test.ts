import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { DbApiError } from './DbApiError.js';
import { ErrorCode } from './ErrorCode.js';
import type { Transport } from './Transport.js';
import { answerWithText, type FakeRequest, FakeServer } from './testing/FakeServer.js';

const consume = async (iterator: AsyncGenerator<unknown, void, void>): Promise<void> => {
	for await (const _item of iterator) {
		// Intentionally left blank.
	}
};

const calls: Record<keyof Transport, (client: Client) => Promise<unknown>> = {
	ping: async (client: Client): Promise<unknown> => await client.ping(),
	verifyApiToken: async (client: Client): Promise<unknown> => await client.verifyApiToken(),
	writeEvents: async (client: Client): Promise<unknown> =>
		await client.writeEvents([
			{
				source: 'https://www.eventsourcingdb.io',
				subject: '/test',
				type: 'io.eventsourcingdb.test',
				data: { value: 23 },
			},
		]),
	readEvents: async (client: Client): Promise<unknown> =>
		await consume(client.readEvents('/', { recursive: true })),
	runEventQlQuery: async (client: Client): Promise<unknown> =>
		await consume(client.runEventQlQuery('FROM e IN events PROJECT INTO e')),
	observeEvents: async (client: Client): Promise<unknown> =>
		await consume(client.observeEvents('/', { recursive: true })),
	registerEventSchema: async (client: Client): Promise<unknown> =>
		await client.registerEventSchema('io.eventsourcingdb.test', { type: 'object' }),
	readSubjects: async (client: Client): Promise<unknown> =>
		await consume(client.readSubjects('/', { recursive: true })),
	readEventType: async (client: Client): Promise<unknown> =>
		await client.readEventType('io.eventsourcingdb.test'),
	readEventTypes: async (client: Client): Promise<unknown> =>
		await consume(client.readEventTypes()),
};

const callNames: (keyof Transport)[] = [
	'ping',
	'verifyApiToken',
	'writeEvents',
	'readEvents',
	'runEventQlQuery',
	'observeEvents',
	'registerEventSchema',
	'readSubjects',
	'readEventType',
	'readEventTypes',
];

interface Case {
	call: keyof Transport;
	status: number;
	text: string;
	code: string | undefined;
}

// The errors of EventSourcingDB 1.2.0, with the status and the text it sends
// for each, and the code of the v2 API that clearly matches it, if any.
const cases: Case[] = [
	{
		call: 'writeEvents',
		status: 409,
		text: 'state conflict: precondition failed',
		code: ErrorCode.preconditionViolated,
	},
	{
		call: 'writeEvents',
		status: 409,
		text: 'state conflict: exceeded max store capacity',
		code: ErrorCode.capacityExceeded,
	},
	{
		call: 'writeEvents',
		status: 409,
		text: 'schema conflict: event candidate does not match schema: expected string, but got number',
		code: ErrorCode.eventSchemaViolated,
	},
	{
		call: 'registerEventSchema',
		status: 409,
		text: 'schema conflict: schema already exists',
		code: ErrorCode.eventSchemaAlreadyRegistered,
	},
	{
		call: 'registerEventSchema',
		status: 409,
		text: 'schema conflict: event with ID 0: expected string, but got number',
		code: ErrorCode.eventSchemaViolated,
	},
	{
		call: 'readEvents',
		status: 409,
		text: 'state conflict: fromLatestEvent results in an event ID greater than upperBound ID',
		code: ErrorCode.rangeUnsatisfiable,
	},
	{
		call: 'readEventType',
		status: 404,
		text: "event type 'io.eventsourcingdb.test' not found",
		code: ErrorCode.eventTypeUnknown,
	},
	...callNames.map(
		(call): Case => ({
			call,
			status: 503,
			text: 'the current operation mode conflicts with the given request: writing is not permitted',
			code: ErrorCode.storeReadOnly,
		}),
	),
	{
		call: 'writeEvents',
		status: 507,
		text: 'insufficient storage',
		code: ErrorCode.licenseInvalid,
	},

	// These have no code, since none of the v2 API clearly matches them, or
	// since their text belongs to another call.
	{
		call: 'writeEvents',
		status: 409,
		text: 'schema conflict: event with ID 0: expected string, but got number',
		code: undefined,
	},
	{
		call: 'readEvents',
		status: 409,
		text: 'state conflict: precondition failed',
		code: undefined,
	},
	{
		call: 'readEvents',
		status: 404,
		text: '404 page not found',
		code: undefined,
	},
	{
		call: 'readEventType',
		status: 400,
		text: "invalid event type: 'io.eventsourcingdb.'",
		code: undefined,
	},
	{
		call: 'writeEvents',
		status: 503,
		text: 'server is shutting down',
		code: undefined,
	},
	{
		call: 'verifyApiToken',
		status: 401,
		text: 'unauthorized',
		code: undefined,
	},
];

suite('v1 error codes', { timeout: 30_000 }, () => {
	let server: FakeServer;
	let client: Client;

	beforeEach(async () => {
		server = new FakeServer('v1');
		await server.start();

		client = new Client(server.url, 'secret');
	});

	afterEach(async () => {
		await server.stop();
	});

	const defineTestFor = ({ call, status, text, code }: Case): void => {
		test(`assigns ${code === undefined ? 'no code' : `'${code.replace('https://docs.eventsourcingdb.io/errors/', '')}'`} to ${call} with ${status} '${text}'.`, async (): Promise<void> => {
			server.respond = (_request: FakeRequest, response: ServerResponse): void => {
				answerWithText(response, status, text);
			};

			await assert.rejects(calls[call](client), (error: unknown): boolean => {
				assert.ok(error instanceof DbApiError);
				assert.equal(error.name, 'DbApiError');
				assert.equal(error.status, status);
				assert.equal(error.description, text);
				assert.equal(error.message, text);
				assert.equal(error.code, code);
				assert.deepEqual(error.details, {});
				assert.equal(error.retryAfter, undefined);

				return true;
			});
		});
	};

	for (const errorCase of cases) {
		defineTestFor(errorCase);
	}
});
