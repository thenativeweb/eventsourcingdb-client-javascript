import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { lines } from './testing/answers.js';
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
					message: `Failed to ${action}, since the stream ended before its end item.`,
				});
			});
		});
	};

	for (const stream of streams) {
		defineTestsFor(stream);
	}

	test('ends observing events without an error if the stream ends, since it has no end item.', async (): Promise<void> => {
		server.respond = (_request: FakeRequest, response: ServerResponse): void => {
			writeHead(response, 200, ndJson);
			response.end(`${event('0')}${heartbeat}`);
		};

		const eventsObserved = await consume(client.observeEvents('/', { recursive: true }));

		assert.equal(eventsObserved.length, 1);
	});
});
