import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';

const abortAfter = 100;

interface Request {
	name: string;
	run: (client: Client, signal: AbortSignal) => Promise<unknown>;
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
	},
	{
		name: 'registerEventSchema',
		run: async (client: Client, signal: AbortSignal): Promise<unknown> =>
			await client.registerEventSchema('io.eventsourcingdb.test', {}, signal),
	},
	{
		name: 'readEventType',
		run: async (client: Client, signal: AbortSignal): Promise<unknown> =>
			await client.readEventType('io.eventsourcingdb.test', signal),
	},
];

const isAbortError = (error: unknown): boolean =>
	error instanceof DOMException && error.name === 'AbortError';

suite('abortSignal', { timeout: 30_000 }, () => {
	let server: Server;
	let client: Client;
	let connectionClosed: PromiseWithResolvers<void>;
	let shouldSendHeaders: boolean;

	beforeEach(async () => {
		connectionClosed = Promise.withResolvers<void>();
		shouldSendHeaders = false;

		// The server never completes a response, so only aborting can end a request.
		server = createServer((_request, response) => {
			response.on('close', () => connectionClosed.resolve());

			if (shouldSendHeaders) {
				response.writeHead(200, {
					server: 'EventSourcingDB/test',
					'content-type': 'application/json',
				});
				response.write('{');
			}
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
		server.closeAllConnections();
		await new Promise<void>(resolve => {
			server.close(() => resolve());
		});
	});

	const defineTestsFor = ({ name, run }: Request): void => {
		suite(name, () => {
			test('throws an abort error if the caller aborts.', async (): Promise<void> => {
				const controller = new AbortController();
				setTimeout(() => {
					controller.abort();
				}, abortAfter);

				await assert.rejects(async () => await run(client, controller.signal), isAbortError);

				await connectionClosed.promise;
			});

			test('throws the reason the caller aborts with.', async (): Promise<void> => {
				const reason = new Error('Aborted by the caller.');
				const controller = new AbortController();
				setTimeout(() => {
					controller.abort(reason);
				}, abortAfter);

				await assert.rejects(
					async () => await run(client, controller.signal),
					(error: unknown): boolean => error === reason,
				);
			});

			test('throws an abort error if the signal has been aborted before.', async (): Promise<void> => {
				await assert.rejects(async () => await run(client, AbortSignal.abort()), isAbortError);
			});
		});
	};

	for (const request of requests) {
		defineTestsFor(request);
	}

	test('throws an abort error if the caller aborts while the response body arrives.', async (): Promise<void> => {
		shouldSendHeaders = true;

		const controller = new AbortController();
		setTimeout(() => {
			controller.abort();
		}, abortAfter);

		await assert.rejects(async () => await client.ping(controller.signal), isAbortError);

		await connectionClosed.promise;
	});
});
