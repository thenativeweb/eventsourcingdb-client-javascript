import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from './Client.js';
import { ConnectionStalledError } from './ConnectionStalledError.js';
import type { ApiVersion } from './detectApiVersion.js';
import type { Event } from './Event.js';
import { OutcomeUnknownError } from './OutcomeUnknownError.js';
import { type Answer, answers, apiVersions, lines } from './testing/answers.js';
import { type FakeRequest, FakeServer, writeHead } from './testing/FakeServer.js';

const stallTimeout = 250;

// The client does not send a request here, it only needs a URL.
const unusedUrl = new URL('http://localhost:3000/');
const heartbeatInterval = 50;

const ndJson = 'application/x-ndjson';

const sendHeartbeats = (response: ServerResponse, heartbeatLine: string): void => {
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

// A write that stalls may have been stored nonetheless.
const isWriteThatStalled =
	(causeCode: 'UND_ERR_HEADERS_TIMEOUT' | 'UND_ERR_BODY_TIMEOUT') =>
	(error: unknown): boolean =>
		error instanceof OutcomeUnknownError && isConnectionStalledError(causeCode)(error.cause);

const isConnectionStalledError30Seconds = (error: unknown): boolean =>
	error instanceof ConnectionStalledError &&
	error.message === 'Nothing arrived from the server for 30 seconds.';

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
	answer?: Answer;
	isWrite?: boolean;
}

const getRequests = (apiVersion: ApiVersion): Request[] => {
	const { event, subject, eventType, end } = lines[apiVersion];

	return [
		{
			name: 'ping',
			run: async (client: Client): Promise<unknown> => await client.ping(),
			answer: answers[apiVersion].ping,
		},
		{
			name: 'verifyApiToken',
			run: async (client: Client): Promise<unknown> => await client.verifyApiToken(),
			answer: answers[apiVersion].verifyApiToken,
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
			answer: answers[apiVersion].writeEvents,
			isWrite: true,
		},
		{
			name: 'registerEventSchema',
			run: async (client: Client): Promise<unknown> =>
				await client.registerEventSchema('io.eventsourcingdb.test', {}),
			answer: answers[apiVersion].registerEventSchema,
			isWrite: true,
		},
		{
			name: 'readEventType',
			run: async (client: Client): Promise<unknown> =>
				await client.readEventType('io.eventsourcingdb.test'),
			answer: answers[apiVersion].readEventType,
		},
		{
			name: 'readEvents',
			run: async (client: Client): Promise<unknown> =>
				await consume(client.readEvents('/', { recursive: true })),
			answer: { contentType: ndJson, body: `${event('0')}${event('1')}${end}` },
		},
		{
			name: 'readSubjects',
			run: async (client: Client): Promise<unknown> =>
				await consume(client.readSubjects('/', { recursive: true })),
			answer: { contentType: ndJson, body: `${subject('/')}${subject('/test')}${end}` },
		},
		{
			name: 'readEventTypes',
			run: async (client: Client): Promise<unknown> => await consume(client.readEventTypes()),
			answer: { contentType: ndJson, body: `${eventType('io.eventsourcingdb.test')}${end}` },
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
};

suite('stallTimeout', { timeout: 30_000 }, () => {
	// The first call of fetch loads its implementation, which may take longer
	// than the stall timeout on a busy machine, so the tests start after it.
	before(async () => {
		const warmUpServer = new FakeServer();
		warmUpServer.respond = (_request: FakeRequest, response: ServerResponse): void => {
			response.end();
		};
		await warmUpServer.start();

		const warmUpResponse = await fetch(warmUpServer.url);
		await warmUpResponse.text();

		await warmUpServer.stop();
	});

	suite('options', () => {
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

		test('names the default stall timeout in the message of its error.', (): void => {
			assert.equal(
				new ConnectionStalledError().message,
				'Nothing arrived from the server for 30 seconds.',
			);
		});
	});

	for (const apiVersion of apiVersions) {
		const { event, row, heartbeat, end } = lines[apiVersion];

		suite(apiVersion, () => {
			let server: FakeServer;
			let client: Client;

			beforeEach(async () => {
				server = new FakeServer(apiVersion);
				await server.start();

				client = new Client(server.url, 'secret', { stallTimeout });
			});

			afterEach(async () => {
				await server.stop();
			});

			suite('defaults', () => {
				// The clock of the test is mocked, so the tests can let 30 seconds
				// pass at once. They wait for the request to reach the server with the
				// real clock, since connecting does not use the mocked timers.
				const waitForIo = async (): Promise<void> => {
					await new Promise<void>(resolve => {
						setImmediate(resolve);
					});
				};

				test('fails a request once nothing arrives for 30 seconds by default.', {
					timeout: 5000,
				}, async (context): Promise<void> => {
					context.mock.timers.enable({ apis: ['setTimeout'] });

					let hasSettled = false;
					const pinged = new Client(server.url, 'secret').ping().finally(() => {
						hasSettled = true;
					});
					const rejected = assert.rejects(pinged, isConnectionStalledError30Seconds);

					await server.requestReceived;

					context.mock.timers.tick(29_999);
					await waitForIo();
					assert.equal(hasSettled, false);

					context.mock.timers.tick(1);
					await rejected;
				});

				test('ends a stream with heartbeats once nothing arrives for 30 seconds by default.', {
					timeout: 5000,
				}, async (context): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, ndJson);
						response.flushHeaders();
					};

					// Notices when the response headers of the stream have arrived at
					// the client, since the clock starts anew then.
					const originalFetch = globalThis.fetch;
					const headersArrived = Promise.withResolvers<void>();
					globalThis.fetch = async (...parameters: Parameters<typeof fetch>): Promise<Response> => {
						const response = await originalFetch(...parameters);
						if (String(parameters[0]).includes('observe-events')) {
							headersArrived.resolve();
						}
						return response;
					};

					try {
						context.mock.timers.enable({ apis: ['setTimeout'] });

						let hasSettled = false;
						const observed = consume(
							new Client(server.url, 'secret').observeEvents('/', { recursive: true }),
						).finally(() => {
							hasSettled = true;
						});
						const rejected = assert.rejects(observed, isConnectionStalledError30Seconds);

						await headersArrived.promise;
						await waitForIo();

						context.mock.timers.tick(29_999);
						await waitForIo();
						assert.equal(hasSettled, false);

						context.mock.timers.tick(1);
						await rejected;
					} finally {
						globalThis.fetch = originalFetch;
					}
				});
			});

			const defineTestsFor = ({ name, run, answer, isWrite = false }: Request): void => {
				suite(name, () => {
					test(`fails with ${isWrite ? 'an unknown outcome after ' : ''}a connection stalled error if the response headers do not arrive in time.`, {
						timeout: 5000,
					}, async (): Promise<void> => {
						const startedAt = performance.now();
						await assert.rejects(
							async () => await run(client),
							isWrite
								? isWriteThatStalled('UND_ERR_HEADERS_TIMEOUT')
								: isConnectionStalledError('UND_ERR_HEADERS_TIMEOUT'),
						);

						const elapsed = performance.now() - startedAt;
						assert.ok(elapsed >= stallTimeout - 10);
						assert.ok(elapsed < stallTimeout * 4);

						await server.connectionsClosed();
					});

					if (answer === undefined) {
						return;
					}

					test(`fails with ${isWrite ? 'an unknown outcome after ' : ''}a connection stalled error if the response body stalls.`, {
						timeout: 5000,
					}, async (): Promise<void> => {
						server.respond = (_request: FakeRequest, response: ServerResponse): void => {
							writeHead(response, 200, answer.contentType);
							response.write(answer.body.slice(0, 5));
						};

						const startedAt = performance.now();
						await assert.rejects(
							async () => await run(client),
							isWrite
								? isWriteThatStalled('UND_ERR_BODY_TIMEOUT')
								: isConnectionStalledError('UND_ERR_BODY_TIMEOUT'),
						);

						const elapsed = performance.now() - startedAt;
						assert.ok(elapsed >= stallTimeout - 10);
						assert.ok(elapsed < stallTimeout * 4);

						await server.connectionsClosed();
					});

					test('does not fail as long as something arrives in time.', async (): Promise<void> => {
						server.respond = (_request: FakeRequest, response: ServerResponse): void => {
							writeHead(response, 200, answer.contentType);
							trickle(response, answer.body);
						};

						// Should not throw.
						await run(client);
					});
				});
			};

			for (const request of getRequests(apiVersion)) {
				defineTestsFor(request);
			}

			suite('readEvents', () => {
				test('does not count the time the caller spends on an event.', async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, ndJson);
						response.end(`${event('0')}${event('1')}${end}`);
					};

					const eventsRead: Event[] = [];
					for await (const eventRead of client.readEvents('/', { recursive: true })) {
						eventsRead.push(eventRead);
						await sleep(stallTimeout * 2);
					}

					assert.equal(eventsRead.length, 2);
				});

				test('ends without an error if the caller aborts while the headers are pending.', async (): Promise<void> => {
					const controller = new AbortController();
					const eventsRead = consume(
						client.readEvents('/', { recursive: true }, controller.signal),
					);

					await server.requestReceived;
					controller.abort();

					assert.deepEqual(await eventsRead, []);
				});
			});

			suite('observeEvents', () => {
				test('ends with a connection stalled error if neither an event nor a heartbeat arrives in time.', {
					timeout: 5000,
				}, async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, ndJson);
						response.write(heartbeat);
					};

					// The signal is never aborted, so only the timeout can close the
					// connection.
					const controller = new AbortController();
					const startedAt = performance.now();

					await assert.rejects(async () => {
						await consume(client.observeEvents('/', { recursive: true }, controller.signal));
					}, isConnectionStalledError('UND_ERR_BODY_TIMEOUT'));

					const elapsed = performance.now() - startedAt;
					assert.ok(elapsed >= stallTimeout - 10);
					assert.ok(elapsed < stallTimeout * 4);

					await server.connectionsClosed();
				});

				test('does not end as long as heartbeats arrive in time.', async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, ndJson);
						sendHeartbeats(response, heartbeat);
						setTimeout(() => {
							response.end(event('0'));
						}, stallTimeout * 4);
					};

					const eventsObserved = await consume(client.observeEvents('/', { recursive: true }));

					assert.equal(eventsObserved.length, 1);
				});

				test('observes events that arrive in time.', async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, ndJson);
						response.write(heartbeat);
						response.write(event('0'));
						setTimeout(() => {
							response.end(event('1'));
						}, stallTimeout / 2);
					};

					const eventsObserved: Event[] = [];
					for await (const eventObserved of client.observeEvents('/', { recursive: true })) {
						eventsObserved.push(eventObserved);
					}

					assert.equal(eventsObserved.length, 2);
					assert.equal(eventsObserved[0]?.id, '0');
					assert.equal(eventsObserved[1]?.id, '1');
				});

				test('does not count the time the caller spends on an event.', async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, ndJson);
						response.write(event('0'));
						sendHeartbeats(response, heartbeat);
						setTimeout(() => {
							response.end(event('1'));
						}, stallTimeout * 4);
					};

					const eventsObserved: Event[] = [];
					for await (const eventObserved of client.observeEvents('/', { recursive: true })) {
						eventsObserved.push(eventObserved);
						await sleep(stallTimeout * 2);
					}

					assert.equal(eventsObserved.length, 2);
				});

				test('ends without an error if the caller aborts.', async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, ndJson);
						response.write(heartbeat);
					};

					const controller = new AbortController();
					const eventsObserved = consume(
						client.observeEvents('/', { recursive: true }, controller.signal),
					);

					await server.requestReceived;
					controller.abort();

					assert.deepEqual(await eventsObserved, []);
				});
			});

			suite('runEventQlQuery', () => {
				test('ends with a connection stalled error if neither a row nor a heartbeat arrives in time.', {
					timeout: 5000,
				}, async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, ndJson);
						response.write(heartbeat);
					};

					const startedAt = performance.now();

					await assert.rejects(async () => {
						await consume(client.runEventQlQuery('FROM e IN events PROJECT INTO e'));
					}, isConnectionStalledError('UND_ERR_BODY_TIMEOUT'));

					const elapsed = performance.now() - startedAt;
					assert.ok(elapsed >= stallTimeout - 10);
					assert.ok(elapsed < stallTimeout * 4);

					await server.connectionsClosed();
				});

				test('does not end as long as heartbeats arrive in time.', async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, ndJson);
						sendHeartbeats(response, heartbeat);
						setTimeout(() => {
							response.end(`${row({ value: 23 })}${end}`);
						}, stallTimeout * 4);
					};

					const rowsRead = await consume(client.runEventQlQuery('FROM e IN events PROJECT INTO e'));

					assert.deepEqual(rowsRead, [{ value: 23 }]);
				});

				test('reads rows that arrive in time.', async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, ndJson);
						response.write(heartbeat);
						response.write(row({ value: 23 }));
						setTimeout(() => {
							response.end(`${row({ value: 42 })}${end}`);
						}, stallTimeout / 2);
					};

					const rowsRead = await consume(client.runEventQlQuery('FROM e IN events PROJECT INTO e'));

					assert.deepEqual(rowsRead, [{ value: 23 }, { value: 42 }]);
				});

				test('ends without an error if the caller aborts.', async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, ndJson);
						response.write(heartbeat);
					};

					const controller = new AbortController();
					const rowsRead = consume(
						client.runEventQlQuery('FROM e IN events PROJECT INTO e', controller.signal),
					);

					await server.requestReceived;
					controller.abort();

					assert.deepEqual(await rowsRead, []);
				});
			});
		});
	}
});
