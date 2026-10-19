import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import type { FakeRequest } from '../testing/FakeServer.js';
import { FakeServer } from '../testing/FakeServer.js';
import { isReachable } from './isReachable.js';

suite('isReachable', () => {
	let server: FakeServer;

	beforeEach(async () => {
		server = new FakeServer();
		await server.start();
	});

	afterEach(async () => {
		await server.stop();
	});

	const answerWith = (status: number): void => {
		server.respond = (_request: FakeRequest, response: ServerResponse): void => {
			response.writeHead(status);
			response.end();
		};
	};

	test('pings the database.', async (): Promise<void> => {
		answerWith(200);

		await isReachable(server.url, new AbortController().signal);

		assert.equal(server.requests.length, 1);
		assert.equal(server.requests[0]?.method, 'GET');
		assert.equal(server.requests[0]?.path, '/api/v1/ping');
	});

	test('accepts the status 200.', async (): Promise<void> => {
		answerWith(200);

		assert.equal(await isReachable(server.url, new AbortController().signal), true);
	});

	test('accepts no other status, not even another one of success.', async (): Promise<void> => {
		for (const status of [201, 202, 204, 299, 404, 500, 503]) {
			answerWith(status);

			// biome-ignore lint/performance/noAwaitInLoops: Each status is checked on its own.
			assert.equal(await isReachable(server.url, new AbortController().signal), false, `${status}`);
		}
	});

	test('does not accept a server that cannot be reached.', async (): Promise<void> => {
		assert.equal(
			await isReachable(new URL('http://localhost:1/'), new AbortController().signal),
			false,
		);
	});
});
