import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import type { ApiVersion } from './detectApiVersion.js';
import type { Event } from './Event.js';
import { apiVersions, lines } from './testing/answers.js';
import { type FakeRequest, FakeServer, writeHead } from './testing/FakeServer.js';

const ndJson = 'application/x-ndjson';

const consume = async (iterator: AsyncGenerator<unknown, void, void>): Promise<unknown[]> => {
	const items: unknown[] = [];
	for await (const item of iterator) {
		items.push(item);
	}
	return items;
};

const { event, row, subject, eventType, heartbeat, end }: (typeof lines)['v2'] = lines.v2;

interface Stream {
	name: string;
	action: string;
	read: (client: Client) => Promise<unknown[]>;
	items: string;
	expected: unknown[];
}

const streams: Stream[] = [
	{
		name: 'readEvents',
		action: 'read events',
		read: async (client: Client): Promise<unknown[]> => {
			const ids: string[] = [];
			for await (const eventRead of client.readEvents('/', { recursive: true })) {
				ids.push(eventRead.id);
			}
			return ids;
		},
		items: `${event('0')}${heartbeat}${event('1')}`,
		expected: ['0', '1'],
	},
	{
		name: 'runEventQlQuery',
		action: 'run EventQL query',
		read: async (client: Client): Promise<unknown[]> =>
			await consume(client.runEventQlQuery('FROM e IN events PROJECT INTO e')),
		items: `${row(23)}${heartbeat}${row(null)}`,
		expected: [23, null],
	},
	{
		name: 'readSubjects',
		action: 'read subjects',
		read: async (client: Client): Promise<unknown[]> =>
			await consume(client.readSubjects('/', { recursive: true })),
		items: `${subject('/')}${heartbeat}${subject('/test')}`,
		expected: ['/', '/test'],
	},
	{
		name: 'readEventTypes',
		action: 'read event types',
		read: async (client: Client): Promise<unknown[]> => await consume(client.readEventTypes()),
		items: `${eventType('io.eventsourcingdb.test')}${heartbeat}`,
		expected: [{ type: 'io.eventsourcingdb.test', hasEvents: true }],
	},
];

suite('streams of the v2 API', { timeout: 30_000 }, () => {
	let server: FakeServer;
	let client: Client;

	beforeEach(async () => {
		server = new FakeServer('v2');
		await server.start();

		client = new Client(server.url, 'secret');
	});

	afterEach(async () => {
		await server.stop();
	});

	const defineTestsFor = ({ name, action, read, items, expected }: Stream): void => {
		suite(name, () => {
			test('ends with the end item.', async (): Promise<void> => {
				server.respond = (_request: FakeRequest, response: ServerResponse): void => {
					writeHead(response, 200, ndJson);

					// The connection stays open after the end item, so only the end
					// item can end the stream.
					response.write(`${items}${end}`);
				};

				assert.deepEqual(await read(client), expected);
			});

			test('fails if the stream ends without its end item.', async (): Promise<void> => {
				server.respond = (_request: FakeRequest, response: ServerResponse): void => {
					writeHead(response, 200, ndJson);
					response.end(items);
				};

				await assert.rejects(read(client), {
					name: 'Error',
					message: `Failed to ${action}, since the stream ended unexpectedly.`,
				});
			});
		});
	};

	for (const stream of streams) {
		defineTestsFor(stream);
	}
});

// Observing never ends on its own, so a stream of observed events that ends
// without an error item broke off, through either API.
suite('observing events', { timeout: 30_000 }, () => {
	const defineTestsFor = (apiVersion: ApiVersion): void => {
		suite(apiVersion, () => {
			let server: FakeServer;
			let client: Client;

			beforeEach(async () => {
				server = new FakeServer(apiVersion);
				await server.start();

				client = new Client(server.url, 'secret');
			});

			afterEach(async () => {
				await server.stop();
			});

			test('fails if the stream ends.', async (): Promise<void> => {
				server.respond = (_request: FakeRequest, response: ServerResponse): void => {
					writeHead(response, 200, ndJson);
					response.end(`${lines[apiVersion].event('0')}${lines[apiVersion].heartbeat}`);
				};

				const eventsObserved: Event[] = [];
				await assert.rejects(
					async () => {
						for await (const eventObserved of client.observeEvents('/', { recursive: true })) {
							eventsObserved.push(eventObserved);
						}
					},
					{
						name: 'Error',
						message: 'Failed to observe events, since the stream ended unexpectedly.',
					},
				);
				assert.equal(eventsObserved.length, 1);
			});

			test('ends without an error if the caller aborts.', async (): Promise<void> => {
				server.respond = (_request: FakeRequest, response: ServerResponse): void => {
					writeHead(response, 200, ndJson);
					response.write(lines[apiVersion].event('0'));
				};

				const controller = new AbortController();
				const eventsObserved: Event[] = [];
				for await (const eventObserved of client.observeEvents(
					'/',
					{ recursive: true },
					controller.signal,
				)) {
					eventsObserved.push(eventObserved);
					controller.abort();
				}

				assert.equal(eventsObserved.length, 1);
			});
		});
	};

	for (const apiVersion of apiVersions) {
		defineTestsFor(apiVersion);
	}
});
