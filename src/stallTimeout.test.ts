import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from './Client.js';
import { ConnectionStalledError } from './ConnectionStalledError.js';
import type { Event } from './Event.js';
import { HeartbeatTimeoutError } from './HeartbeatTimeoutError.js';

const stallTimeout = 250;

// The client does not send a request here, it only needs a URL.
const unusedUrl = new URL('http://localhost:3000/');
const heartbeatInterval = 50;

const heartbeatLine = '{"type":"heartbeat","payload":{}}\n';

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

const getEventLine = (id: string): string =>
	`${JSON.stringify({ type: 'event', payload: getCloudEvent(id) })}\n`;

const getRowLine = (value: number): string =>
	`${JSON.stringify({ type: 'row', payload: { value } })}\n`;

const getSubjectLine = (subject: string): string =>
	`${JSON.stringify({ type: 'subject', payload: { subject } })}\n`;

const getEventTypeLine = (eventType: string): string =>
	`${JSON.stringify({ type: 'eventType', payload: { eventType, isPhantom: false } })}\n`;

const writeHead = (response: ServerResponse): void => {
	response.writeHead(200, {
		server: 'EventSourcingDB/test',
		'content-type': 'application/json',
	});
};

const sendHeartbeats = (response: ServerResponse): void => {
	const interval = setInterval(() => {
		response.write(heartbeatLine);
	}, heartbeatInterval);

	response.on('close', () => {
		clearInterval(interval);
	});
};

// Sends the text in three parts, each of which arrives after half the stall
// timeout, so the whole response takes longer than the stall timeout.
const trickle = (response: ServerResponse, text: string): void => {
	const third = Math.ceil(text.length / 3);
	const parts = [text.slice(0, third), text.slice(third, third * 2), text.slice(third * 2)];

	parts.forEach((part, index) => {
		setTimeout(
			() => {
				if (index === parts.length - 1) {
					response.end(part);
					return;
				}
				response.write(part);
			},
			(stallTimeout / 2) * (index + 1),
		);
	});
};

// A stall carries the code that the timeout error of fetch has for the same
// situation as its cause, so that code that checks it keeps working.
const isConnectionStalledError =
	(causeCode: 'UND_ERR_HEADERS_TIMEOUT' | 'UND_ERR_BODY_TIMEOUT') =>
	(error: unknown): boolean =>
		error instanceof ConnectionStalledError &&
		error instanceof TypeError &&
		error.name === 'ConnectionStalledError' &&
		error.message === 'Nothing arrived from the server for 250 milliseconds.' &&
		error.cause instanceof Error &&
		'code' in error.cause &&
		error.cause.code === causeCode;

const isHeartbeatTimeoutError = (error: unknown): boolean =>
	error instanceof HeartbeatTimeoutError &&
	error.name === 'HeartbeatTimeoutError' &&
	error.message === 'No event and no heartbeat arrived for 250 milliseconds.';

const consume = async (iterator: AsyncGenerator<unknown, void, void>): Promise<unknown[]> => {
	const items: unknown[] = [];
	for await (const item of iterator) {
		items.push(item);
	}
	return items;
};

interface Request {
	name: string;
	run: (client: Client) => Promise<unknown>;
	responseBody?: string;
}

const requests: Request[] = [
	{
		name: 'ping',
		run: async (client: Client): Promise<unknown> => await client.ping(),
		responseBody: '{"type":"io.eventsourcingdb.api.ping-received"}',
	},
	{
		name: 'verifyApiToken',
		run: async (client: Client): Promise<unknown> => await client.verifyApiToken(),
		responseBody: '{"type":"io.eventsourcingdb.api.api-token-verified"}',
	},
	{
		name: 'writeEvents',
		run: async (client: Client): Promise<unknown> =>
			await client.writeEvents([
				{
					source: 'https://www.eventsourcingdb.io',
					subject: '/test',
					type: 'io.eventsourcingdb.test',
					data: { value: 23 },
				},
			]),
		responseBody: JSON.stringify([getCloudEvent('0')]),
	},
	{
		name: 'registerEventSchema',
		run: async (client: Client): Promise<unknown> =>
			await client.registerEventSchema('io.eventsourcingdb.test', {}),
	},
	{
		name: 'readEventType',
		run: async (client: Client): Promise<unknown> =>
			await client.readEventType('io.eventsourcingdb.test'),
		responseBody: '{"eventType":"io.eventsourcingdb.test","isPhantom":false}',
	},
	{
		name: 'readEvents',
		run: async (client: Client): Promise<unknown> =>
			await consume(client.readEvents('/', { recursive: true })),
		responseBody: `${getEventLine('0')}${getEventLine('1')}`,
	},
	{
		name: 'readSubjects',
		run: async (client: Client): Promise<unknown> => await consume(client.readSubjects('/')),
		responseBody: `${getSubjectLine('/')}${getSubjectLine('/test')}`,
	},
	{
		name: 'readEventTypes',
		run: async (client: Client): Promise<unknown> => await consume(client.readEventTypes()),
		responseBody: getEventTypeLine('io.eventsourcingdb.test'),
	},
	{
		name: 'observeEvents',
		run: async (client: Client): Promise<unknown> =>
			await consume(client.observeEvents('/', { recursive: true })),
	},
	{
		name: 'runEventQlQuery',
		run: async (client: Client): Promise<unknown> =>
			await consume(client.runEventQlQuery('FROM e IN events PROJECT INTO e')),
	},
];

suite('stallTimeout', { timeout: 30_000 }, () => {
	// The first call of fetch loads its implementation, which may take longer
	// than the stall timeout on a busy machine, so the tests start after it.
	before(async () => {
		const warmUpServer = createServer((_request, warmUpResponse) => {
			warmUpResponse.end();
		});
		await new Promise<void>(resolve => {
			warmUpServer.listen(0, 'localhost', resolve);
		});

		const address = warmUpServer.address();
		if (address === null || typeof address === 'string') {
			throw new Error('Failed to get server address.');
		}

		const response = await fetch(`http://localhost:${address.port}/`);
		await response.text();

		warmUpServer.closeAllConnections();
		await new Promise<void>(resolve => {
			warmUpServer.close(() => resolve());
		});
	});

	let server: Server;
	let url: URL;
	let client: Client;
	let respond: (request: IncomingMessage, response: ServerResponse) => void;
	let requestReceived: PromiseWithResolvers<void>;
	let connectionsClosed: Promise<unknown>[];

	beforeEach(async () => {
		requestReceived = Promise.withResolvers<void>();
		connectionsClosed = [];

		server = createServer((request, response) => {
			requestReceived.resolve();
			respond(request, response);
		});

		// A request that stalls before it reaches the server leaves no connection
		// to close, so the tests wait for the connections that were opened.
		server.on('connection', socket => {
			connectionsClosed.push(once(socket, 'close'));
		});

		await new Promise<void>(resolve => {
			server.listen(0, 'localhost', resolve);
		});

		const address = server.address();
		if (address === null || typeof address === 'string') {
			throw new Error('Failed to get server address.');
		}

		url = new URL(`http://localhost:${address.port}/`);
		client = new Client(url, 'secret', { stallTimeout });
	});

	afterEach(async () => {
		server.closeAllConnections();
		await new Promise<void>(resolve => {
			server.close(() => resolve());
		});
	});

	suite('options', () => {
		test('defaults to 30 seconds.', (): void => {
			assert.equal(
				new HeartbeatTimeoutError().message,
				'No event and no heartbeat arrived for 30 seconds.',
			);
			assert.equal(
				new ConnectionStalledError().message,
				'Nothing arrived from the server for 30 seconds.',
			);

			assert.ok(new Client(unusedUrl, 'secret'));
			assert.ok(new Client(unusedUrl, 'secret', {}));
		});

		test('accepts a stall timeout from 1 millisecond up to the longest timer of Node.js.', (): void => {
			assert.ok(new Client(unusedUrl, 'secret', { stallTimeout: 1 }));
			assert.ok(new Client(unusedUrl, 'secret', { stallTimeout: 2_147_483_647 }));
		});

		test('throws an error if the stall timeout is out of range.', (): void => {
			for (const invalidStallTimeout of [
				0,
				-1,
				2_147_483_648,
				Number.NaN,
				Number.POSITIVE_INFINITY,
			]) {
				assert.throws(
					(): Client => new Client(unusedUrl, 'secret', { stallTimeout: invalidStallTimeout }),
					{
						name: 'Error',
						message: `Stall timeout must be between 1 and 2147483647 milliseconds, got '${invalidStallTimeout}'.`,
					},
				);
			}
		});
	});

	const defineTestsFor = ({ name, run, responseBody }: Request): void => {
		suite(name, () => {
			test('fails with a connection stalled error if the response headers do not arrive in time.', {
				timeout: 5000,
			}, async (): Promise<void> => {
				respond = (): void => {
					// Intentionally left blank, so that the headers never arrive.
				};

				const startedAt = performance.now();
				await assert.rejects(
					async () => await run(client),
					isConnectionStalledError('UND_ERR_HEADERS_TIMEOUT'),
				);

				const elapsed = performance.now() - startedAt;
				assert.ok(elapsed >= stallTimeout - 10);
				assert.ok(elapsed < stallTimeout * 4);

				await Promise.all(connectionsClosed);
			});

			if (responseBody === undefined) {
				return;
			}

			test('fails with a connection stalled error if the response body stalls.', {
				timeout: 5000,
			}, async (): Promise<void> => {
				respond = (_request: IncomingMessage, response: ServerResponse): void => {
					writeHead(response);
					response.write(responseBody.slice(0, 5));
				};

				const startedAt = performance.now();
				await assert.rejects(
					async () => await run(client),
					isConnectionStalledError('UND_ERR_BODY_TIMEOUT'),
				);

				const elapsed = performance.now() - startedAt;
				assert.ok(elapsed >= stallTimeout - 10);
				assert.ok(elapsed < stallTimeout * 4);

				await Promise.all(connectionsClosed);
			});

			test('does not fail as long as something arrives in time.', async (): Promise<void> => {
				respond = (_request: IncomingMessage, response: ServerResponse): void => {
					writeHead(response);
					trickle(response, responseBody);
				};

				// Should not throw.
				await run(client);
			});
		});
	};

	for (const request of requests) {
		defineTestsFor(request);
	}

	suite('readEvents', () => {
		test('does not count the time the caller spends on an event.', async (): Promise<void> => {
			respond = (_request: IncomingMessage, response: ServerResponse): void => {
				writeHead(response);
				response.end(`${getEventLine('0')}${getEventLine('1')}`);
			};

			const eventsRead: Event[] = [];
			for await (const event of client.readEvents('/', { recursive: true })) {
				eventsRead.push(event);
				await sleep(stallTimeout * 2);
			}

			assert.equal(eventsRead.length, 2);
		});

		test('ends without an error if the caller aborts while the headers are pending.', async (): Promise<void> => {
			respond = (): void => {
				// Intentionally left blank, so that the headers never arrive.
			};

			const controller = new AbortController();
			const eventsRead = consume(client.readEvents('/', { recursive: true }, controller.signal));

			await requestReceived.promise;
			controller.abort();

			assert.deepEqual(await eventsRead, []);
		});
	});

	suite('observeEvents', () => {
		test('ends with a heartbeat timeout error if neither an event nor a heartbeat arrives in time.', {
			timeout: 5000,
		}, async (): Promise<void> => {
			respond = (_request: IncomingMessage, response: ServerResponse): void => {
				writeHead(response);
				response.write(heartbeatLine);
			};

			// The signal is never aborted, so only the timeout can close the connection.
			const controller = new AbortController();
			const startedAt = performance.now();

			await assert.rejects(async () => {
				await consume(client.observeEvents('/', { recursive: true }, controller.signal));
			}, isHeartbeatTimeoutError);

			const elapsed = performance.now() - startedAt;
			assert.ok(elapsed >= stallTimeout - 10);
			assert.ok(elapsed < stallTimeout * 4);

			await Promise.all(connectionsClosed);
		});

		test('does not end as long as heartbeats arrive in time.', async (): Promise<void> => {
			respond = (_request: IncomingMessage, response: ServerResponse): void => {
				writeHead(response);
				sendHeartbeats(response);
				setTimeout(() => {
					response.end(getEventLine('0'));
				}, stallTimeout * 4);
			};

			const eventsObserved = await consume(client.observeEvents('/', { recursive: true }));

			assert.equal(eventsObserved.length, 1);
		});

		test('observes events that arrive in time.', async (): Promise<void> => {
			respond = (_request: IncomingMessage, response: ServerResponse): void => {
				writeHead(response);
				response.write(heartbeatLine);
				response.write(getEventLine('0'));
				setTimeout(() => {
					response.end(getEventLine('1'));
				}, stallTimeout / 2);
			};

			const eventsObserved: Event[] = [];
			for await (const event of client.observeEvents('/', { recursive: true })) {
				eventsObserved.push(event);
			}

			assert.equal(eventsObserved.length, 2);
			assert.equal(eventsObserved[0]?.id, '0');
			assert.equal(eventsObserved[1]?.id, '1');
		});

		test('does not count the time the caller spends on an event.', async (): Promise<void> => {
			respond = (_request: IncomingMessage, response: ServerResponse): void => {
				writeHead(response);
				response.write(getEventLine('0'));
				sendHeartbeats(response);
				setTimeout(() => {
					response.end(getEventLine('1'));
				}, stallTimeout * 4);
			};

			const eventsObserved: Event[] = [];
			for await (const event of client.observeEvents('/', { recursive: true })) {
				eventsObserved.push(event);
				await sleep(stallTimeout * 2);
			}

			assert.equal(eventsObserved.length, 2);
		});

		test('ends without an error if the caller aborts.', async (): Promise<void> => {
			respond = (_request: IncomingMessage, response: ServerResponse): void => {
				writeHead(response);
				response.write(heartbeatLine);
			};

			const controller = new AbortController();
			const eventsObserved = consume(
				client.observeEvents('/', { recursive: true }, controller.signal),
			);

			await requestReceived.promise;
			controller.abort();

			assert.deepEqual(await eventsObserved, []);
		});
	});

	suite('runEventQlQuery', () => {
		test('ends with a heartbeat timeout error if neither a row nor a heartbeat arrives in time.', {
			timeout: 5000,
		}, async (): Promise<void> => {
			respond = (_request: IncomingMessage, response: ServerResponse): void => {
				writeHead(response);
				response.write(heartbeatLine);
			};

			const startedAt = performance.now();

			await assert.rejects(async () => {
				await consume(client.runEventQlQuery('FROM e IN events PROJECT INTO e'));
			}, isHeartbeatTimeoutError);

			const elapsed = performance.now() - startedAt;
			assert.ok(elapsed >= stallTimeout - 10);
			assert.ok(elapsed < stallTimeout * 4);

			await Promise.all(connectionsClosed);
		});

		test('does not end as long as heartbeats arrive in time.', async (): Promise<void> => {
			respond = (_request: IncomingMessage, response: ServerResponse): void => {
				writeHead(response);
				sendHeartbeats(response);
				setTimeout(() => {
					response.end(getRowLine(23));
				}, stallTimeout * 4);
			};

			const rowsRead = await consume(client.runEventQlQuery('FROM e IN events PROJECT INTO e'));

			assert.deepEqual(rowsRead, [{ value: 23 }]);
		});

		test('reads rows that arrive in time.', async (): Promise<void> => {
			respond = (_request: IncomingMessage, response: ServerResponse): void => {
				writeHead(response);
				response.write(heartbeatLine);
				response.write(getRowLine(23));
				setTimeout(() => {
					response.end(getRowLine(42));
				}, stallTimeout / 2);
			};

			const rowsRead = await consume(client.runEventQlQuery('FROM e IN events PROJECT INTO e'));

			assert.deepEqual(rowsRead, [{ value: 23 }, { value: 42 }]);
		});

		test('ends without an error if the caller aborts.', async (): Promise<void> => {
			respond = (_request: IncomingMessage, response: ServerResponse): void => {
				writeHead(response);
				response.write(heartbeatLine);
			};

			const controller = new AbortController();
			const rowsRead = consume(
				client.runEventQlQuery('FROM e IN events PROJECT INTO e', controller.signal),
			);

			await requestReceived.promise;
			controller.abort();

			assert.deepEqual(await rowsRead, []);
		});
	});
});
