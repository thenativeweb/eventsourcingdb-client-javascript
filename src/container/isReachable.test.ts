import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import type { FakeRequest } from '../testing/FakeServer.js';
import { FakeServer } from '../testing/FakeServer.js';
import { isReachable, pingTimeout } from './isReachable.js';

const v2PingPath = '/api/v2/system/ping';
const v1PingPath = '/api/v1/ping';

interface Answer {
	status: number;
	delay?: number;
}

suite('isReachable', () => {
	let server: FakeServer;

	beforeEach(async () => {
		server = new FakeServer();
		await server.start();
	});

	afterEach(async () => {
		await server.stop();
	});

	// Answers each path with its answer, after its delay, and leaves a path
	// without an answer unanswered.
	const answerWith = (answers: Record<string, Answer>): void => {
		server.respond = (request: FakeRequest, response: ServerResponse): void => {
			const answer = answers[request.path];
			if (answer === undefined) {
				return;
			}

			setTimeout(() => {
				response.writeHead(answer.status);
				response.end();
			}, answer.delay ?? 0);
		};
	};

	const isServerReachable = async (): Promise<boolean> =>
		await isReachable(server.url, new AbortController().signal);

	const getRequests = (): string[] =>
		server.requests.map(({ method, path }) => `${method} ${path}`);

	test('pings the database through the v2 API, and accepts the status 200 without asking the v1 API.', async (): Promise<void> => {
		answerWith({ [v2PingPath]: { status: 200 }, [v1PingPath]: { status: 200 } });

		assert.equal(await isServerReachable(), true);
		assert.deepEqual(getRequests(), [`GET ${v2PingPath}`]);
	});

	test('accepts the status 200 of the v2 API from a server without the v1 API.', async (): Promise<void> => {
		answerWith({ [v2PingPath]: { status: 200 }, [v1PingPath]: { status: 404 } });

		assert.equal(await isServerReachable(), true);
	});

	const defineV1FallbackTest = (status: number): void => {
		test(`asks the v1 API if the v2 API answers with ${status}, as a server without the v2 API does, and accepts its status 200.`, async (): Promise<void> => {
			answerWith({ [v2PingPath]: { status }, [v1PingPath]: { status: 200 } });

			assert.equal(await isServerReachable(), true);
			assert.deepEqual(getRequests(), [`GET ${v2PingPath}`, `GET ${v1PingPath}`]);
		});
	};

	for (const status of [404, 405]) {
		defineV1FallbackTest(status);
	}

	const defineOtherV2StatusTest = (status: number): void => {
		test(`does not accept the status ${status} of the v2 API, and does not ask the v1 API then.`, async (): Promise<void> => {
			answerWith({ [v2PingPath]: { status }, [v1PingPath]: { status: 200 } });

			assert.equal(await isServerReachable(), false);
			assert.deepEqual(getRequests(), [`GET ${v2PingPath}`]);
		});
	};

	// Only the status 200 counts, not any other status of success.
	for (const status of [201, 202, 204, 299, 400, 500, 503]) {
		defineOtherV2StatusTest(status);
	}

	const defineOtherV1StatusTest = (status: number): void => {
		test(`does not accept the status ${status} of the v1 API.`, async (): Promise<void> => {
			answerWith({ [v2PingPath]: { status: 404 }, [v1PingPath]: { status } });

			assert.equal(await isServerReachable(), false);
		});
	};

	for (const status of [201, 202, 204, 299, 404, 405, 500, 503]) {
		defineOtherV1StatusTest(status);
	}

	test('does not ask the v1 API if the ping of the v2 API gets no answer in time.', async (): Promise<void> => {
		answerWith({ [v1PingPath]: { status: 200 } });

		assert.equal(await isServerReachable(), false);
		assert.deepEqual(getRequests(), [`GET ${v2PingPath}`]);
	});

	test('gives each ping the full time to answer.', async (): Promise<void> => {
		// Each ping answers in time, but both together take longer than one may.
		const delay = pingTimeout * 0.6;
		answerWith({
			[v2PingPath]: { status: 404, delay },
			[v1PingPath]: { status: 200, delay },
		});

		assert.equal(await isServerReachable(), true);
	});

	test('asks the v2 API first on every call, without remembering an earlier answer.', async (): Promise<void> => {
		answerWith({ [v2PingPath]: { status: 404 }, [v1PingPath]: { status: 200 } });

		assert.equal(await isServerReachable(), true);
		assert.equal(await isServerReachable(), true);
		assert.deepEqual(getRequests(), [
			`GET ${v2PingPath}`,
			`GET ${v1PingPath}`,
			`GET ${v2PingPath}`,
			`GET ${v1PingPath}`,
		]);
	});

	test('does not accept a server that cannot be reached.', async (): Promise<void> => {
		assert.equal(
			await isReachable(new URL('http://localhost:1/'), new AbortController().signal),
			false,
		);
	});
});
