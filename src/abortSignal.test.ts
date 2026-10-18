import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { OutcomeUnknownError } from './OutcomeUnknownError.js';
import { answers, apiVersions } from './testing/answers.js';
import { type FakeRequest, FakeServer, writeHead } from './testing/FakeServer.js';

interface Request {
	name: string;
	run: (client: Client, signal: AbortSignal) => Promise<unknown>;
	isWrite?: boolean;
}

const requests: Request[] = [
	{
		name: 'ping',
		run: async (client: Client, signal: AbortSignal): Promise<unknown> => await client.ping(signal),
	},
	{
		name: 'verifyApiToken',
		run: async (client: Client, signal: AbortSignal): Promise<unknown> =>
			await client.verifyApiToken(signal),
	},
	{
		name: 'writeEvents',
		run: async (client: Client, signal: AbortSignal): Promise<unknown> =>
			await client.writeEvents(
				[
					{
						source: 'https://www.eventsourcingdb.io',
						subject: '/test',
						type: 'io.eventsourcingdb.test',
						data: { value: 23 },
					},
				],
				[],
				signal,
			),
		isWrite: true,
	},
	{
		name: 'registerEventSchema',
		run: async (client: Client, signal: AbortSignal): Promise<unknown> =>
			await client.registerEventSchema('io.eventsourcingdb.test', {}, signal),
		isWrite: true,
	},
	{
		name: 'readEventType',
		run: async (client: Client, signal: AbortSignal): Promise<unknown> =>
			await client.readEventType('io.eventsourcingdb.test', signal),
	},
];

const isAbortError = (error: unknown): boolean =>
	error instanceof DOMException && error.name === 'AbortError';

// Once a write has been sent, aborting it does not undo it, so the write may
// have been stored nonetheless.
const isAbortedWrite =
	(isCause: (cause: unknown) => boolean) =>
	(error: unknown): boolean =>
		error instanceof OutcomeUnknownError && isCause(error.cause);

suite('abortSignal', { timeout: 30_000 }, () => {
	for (const apiVersion of apiVersions) {
		suite(apiVersion, () => {
			let server: FakeServer;
			let client: Client;

			beforeEach(async () => {
				// The server never completes a response, so only aborting can end a
				// request.
				server = new FakeServer(apiVersion);
				await server.start();

				client = new Client(server.url, 'secret');
			});

			afterEach(async () => {
				await server.stop();
			});

			const defineTestsFor = ({ name, run, isWrite = false }: Request): void => {
				suite(name, () => {
					test(`throws ${isWrite ? 'an unknown outcome after ' : ''}an abort error if the caller aborts.`, async (): Promise<void> => {
						const controller = new AbortController();
						const rejected = assert.rejects(
							run(client, controller.signal),
							isWrite ? isAbortedWrite(isAbortError) : isAbortError,
						);

						await server.requestReceived;
						controller.abort();
						await rejected;

						await server.connectionsClosed();
					});

					test(`throws ${isWrite ? 'an unknown outcome after ' : ''}the reason the caller aborts with.`, async (): Promise<void> => {
						const reason = new Error('Aborted by the caller.');
						const isReason = (error: unknown): boolean => error === reason;

						const controller = new AbortController();
						const rejected = assert.rejects(
							run(client, controller.signal),
							isWrite ? isAbortedWrite(isReason) : isReason,
						);

						await server.requestReceived;
						controller.abort(reason);
						await rejected;
					});

					test('throws an abort error if the signal has been aborted before.', async (): Promise<void> => {
						await assert.rejects(async () => await run(client, AbortSignal.abort()), isAbortError);

						assert.equal(server.probeCount, 0);
						assert.equal(server.requests.length, 0);
					});

					test('throws an abort error if the signal has been aborted before, once the client knows the API.', async (): Promise<void> => {
						server.respond = (_request: FakeRequest, response: ServerResponse): void => {
							writeHead(response, 200, answers[apiVersion].ping.contentType);
							response.end(answers[apiVersion].ping.body);
						};
						await client.ping();

						await assert.rejects(async () => await run(client, AbortSignal.abort()), isAbortError);

						assert.equal(server.requests.length, 1);
					});
				});
			};

			for (const request of requests) {
				defineTestsFor(request);
			}

			test('throws an abort error if the caller aborts while the response body arrives.', async (): Promise<void> => {
				server.respond = (_request: FakeRequest, response: ServerResponse): void => {
					writeHead(response, 200, 'application/json');
					response.write('{');
				};

				// Notices when the response headers of the ping have arrived at the
				// client, so the test aborts while the body is pending.
				const originalFetch = globalThis.fetch;
				const headersArrived = Promise.withResolvers<void>();
				let fetchCount = 0;
				globalThis.fetch = async (...parameters: Parameters<typeof fetch>): Promise<Response> => {
					const response = await originalFetch(...parameters);
					fetchCount += 1;

					// The first request finds out which API the server offers.
					if (fetchCount === 2) {
						headersArrived.resolve();
					}
					return response;
				};

				try {
					const controller = new AbortController();
					const rejected = assert.rejects(client.ping(controller.signal), isAbortError);

					await headersArrived.promise;
					controller.abort();
					await rejected;
				} finally {
					globalThis.fetch = originalFetch;
				}

				await server.connectionsClosed();
			});

			test('throws an unknown outcome if the caller aborts a write while the response body arrives.', async (): Promise<void> => {
				server.respond = (_request: FakeRequest, response: ServerResponse): void => {
					writeHead(response, 200, 'application/json');
					response.write(apiVersion === 'v1' ? '[' : '{"type":"heartbeat","data":{}}\n');
				};

				const originalFetch = globalThis.fetch;
				const headersArrived = Promise.withResolvers<void>();
				globalThis.fetch = async (...parameters: Parameters<typeof fetch>): Promise<Response> => {
					const response = await originalFetch(...parameters);
					if (String(parameters[0]).includes('write-events')) {
						headersArrived.resolve();
					}
					return response;
				};

				try {
					const controller = new AbortController();
					const rejected = assert.rejects(
						client.writeEvents(
							[
								{
									source: 'https://www.eventsourcingdb.io',
									subject: '/test',
									type: 'io.eventsourcingdb.test',
									data: { value: 23 },
								},
							],
							[],
							controller.signal,
						),
						isAbortedWrite(isAbortError),
					);

					await headersArrived.promise;
					controller.abort();
					await rejected;
				} finally {
					globalThis.fetch = originalFetch;
				}

				await server.connectionsClosed();
			});
		});
	}
});
