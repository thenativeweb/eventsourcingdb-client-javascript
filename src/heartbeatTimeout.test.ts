import assert from 'node:assert/strict';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from './Client.js';
import type { Event } from './Event.js';
import { HeartbeatTimeoutError } from './HeartbeatTimeoutError.js';
import { heartbeatTimeout } from './heartbeatTimeout.js';

const timeout = 250;
const heartbeatInterval = 50;

const heartbeatLine = '{"type":"heartbeat","payload":{}}\n';

const getEventLine = (id: string): string =>
	`${JSON.stringify({
		type: 'event',
		payload: {
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
		},
	})}\n`;

const getRowLine = (value: number): string =>
	`${JSON.stringify({
		type: 'row',
		payload: { value },
	})}\n`;

const sendHeartbeats = (response: ServerResponse): void => {
	const interval = setInterval(() => {
		response.write(heartbeatLine);
	}, heartbeatInterval);

	response.on('close', () => {
		clearInterval(interval);
	});
};

suite('heartbeatTimeout', { timeout: 30_000 }, () => {
	const originalTimeout = heartbeatTimeout.milliseconds;

	let server: Server;
	let client: Client;
	let respond: (response: ServerResponse) => void;

	beforeEach(async () => {
		heartbeatTimeout.milliseconds = timeout;

		server = createServer((_request, response) => {
			response.writeHead(200, {
				server: 'EventSourcingDB/test',
				'content-type': 'application/x-ndjson',
			});
			respond(response);
		});

		await new Promise<void>(resolve => {
			server.listen(0, 'localhost', resolve);
		});

		const address = server.address();
		if (address === null || typeof address === 'string') {
			throw new Error('Failed to get server address.');
		}

		client = new Client(new URL(`http://localhost:${address.port}/`), 'secret');
	});

	afterEach(async () => {
		heartbeatTimeout.milliseconds = originalTimeout;

		server.closeAllConnections();
		await new Promise<void>(resolve => {
			server.close(() => resolve());
		});
	});

	suite('observeEvents', () => {
		test('ends with a heartbeat timeout error if neither an event nor a heartbeat arrives in time.', {
			timeout: 5000,
		}, async (): Promise<void> => {
			const connectionClosed = Promise.withResolvers<void>();
			respond = (response: ServerResponse): void => {
				response.on('close', () => connectionClosed.resolve());
				response.write(heartbeatLine);
			};

			// The signal is never aborted, so only the timeout can close the connection.
			const controller = new AbortController();
			const startedAt = performance.now();

			await assert.rejects(
				async () => {
					for await (const _event of client.observeEvents(
						'/',
						{ recursive: true },
						controller.signal,
					)) {
						// Intentionally left blank.
					}
				},
				error => {
					assert.ok(error instanceof HeartbeatTimeoutError);
					assert.equal(error.name, 'HeartbeatTimeoutError');
					assert.equal(error.message, 'No event and no heartbeat arrived for 30 seconds.');
					return true;
				},
			);

			const elapsed = performance.now() - startedAt;
			assert.ok(elapsed >= timeout - 10);
			assert.ok(elapsed < timeout * 4);

			await connectionClosed.promise;
		});

		test('does not end as long as heartbeats arrive in time.', async (): Promise<void> => {
			respond = (response: ServerResponse): void => {
				sendHeartbeats(response);
				setTimeout(() => {
					response.end(getEventLine('0'));
				}, timeout * 4);
			};

			const eventsObserved: Event[] = [];
			for await (const event of client.observeEvents('/', { recursive: true })) {
				eventsObserved.push(event);
			}

			assert.equal(eventsObserved.length, 1);
		});

		test('observes events that arrive in time.', async (): Promise<void> => {
			respond = (response: ServerResponse): void => {
				response.write(heartbeatLine);
				response.write(getEventLine('0'));
				setTimeout(() => {
					response.end(getEventLine('1'));
				}, timeout / 2);
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
			respond = (response: ServerResponse): void => {
				response.write(getEventLine('0'));
				sendHeartbeats(response);
				setTimeout(() => {
					response.end(getEventLine('1'));
				}, timeout * 4);
			};

			const eventsObserved: Event[] = [];
			for await (const event of client.observeEvents('/', { recursive: true })) {
				eventsObserved.push(event);
				await sleep(timeout * 2);
			}

			assert.equal(eventsObserved.length, 2);
		});

		test('ends without an error if the caller aborts.', async (): Promise<void> => {
			respond = (response: ServerResponse): void => {
				response.write(heartbeatLine);
			};

			const controller = new AbortController();
			setTimeout(() => {
				controller.abort();
			}, timeout / 2);

			let didObserveEvents = false;
			for await (const _event of client.observeEvents(
				'/',
				{ recursive: true },
				controller.signal,
			)) {
				didObserveEvents = true;
			}

			assert.equal(didObserveEvents, false);
		});
	});

	suite('runEventQlQuery', () => {
		test('ends with a heartbeat timeout error if neither a row nor a heartbeat arrives in time.', {
			timeout: 5000,
		}, async (): Promise<void> => {
			const connectionClosed = Promise.withResolvers<void>();
			respond = (response: ServerResponse): void => {
				response.on('close', () => connectionClosed.resolve());
				response.write(heartbeatLine);
			};

			const startedAt = performance.now();

			await assert.rejects(
				async () => {
					for await (const _row of client.runEventQlQuery('FROM e IN events PROJECT INTO e')) {
						// Intentionally left blank.
					}
				},
				error => {
					assert.ok(error instanceof HeartbeatTimeoutError);
					assert.equal(error.message, 'No event and no heartbeat arrived for 30 seconds.');
					return true;
				},
			);

			const elapsed = performance.now() - startedAt;
			assert.ok(elapsed >= timeout - 10);
			assert.ok(elapsed < timeout * 4);

			await connectionClosed.promise;
		});

		test('does not end as long as heartbeats arrive in time.', async (): Promise<void> => {
			respond = (response: ServerResponse): void => {
				sendHeartbeats(response);
				setTimeout(() => {
					response.end(getRowLine(23));
				}, timeout * 4);
			};

			const rowsRead: unknown[] = [];
			for await (const row of client.runEventQlQuery('FROM e IN events PROJECT INTO e')) {
				rowsRead.push(row);
			}

			assert.deepEqual(rowsRead, [{ value: 23 }]);
		});

		test('reads rows that arrive in time.', async (): Promise<void> => {
			respond = (response: ServerResponse): void => {
				response.write(heartbeatLine);
				response.write(getRowLine(23));
				setTimeout(() => {
					response.end(getRowLine(42));
				}, timeout / 2);
			};

			const rowsRead: unknown[] = [];
			for await (const row of client.runEventQlQuery('FROM e IN events PROJECT INTO e')) {
				rowsRead.push(row);
			}

			assert.deepEqual(rowsRead, [{ value: 23 }, { value: 42 }]);
		});

		test('ends without an error if the caller aborts.', async (): Promise<void> => {
			respond = (response: ServerResponse): void => {
				response.write(heartbeatLine);
			};

			const controller = new AbortController();
			setTimeout(() => {
				controller.abort();
			}, timeout / 2);

			let didReadRows = false;
			for await (const _row of client.runEventQlQuery(
				'FROM e IN events PROJECT INTO e',
				controller.signal,
			)) {
				didReadRows = true;
			}

			assert.equal(didReadRows, false);
		});
	});
});
