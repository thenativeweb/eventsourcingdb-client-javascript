import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { DbApiError } from './DbApiError.js';
import type { ApiVersion } from './detectApiVersion.js';
import type { EventType } from './EventType.js';
import { answers, apiVersions } from './testing/answers.js';
import { answerWithText, type FakeRequest, FakeServer, writeHead } from './testing/FakeServer.js';

const isProbe = (request: FakeRequest): boolean =>
	request.method === 'GET' && request.path === '/api/v2/system/ping';

const answerProbeAsV2 = (response: ServerResponse): void => {
	writeHead(response, 200, answers.v2.ping.contentType);
	response.end(answers.v2.ping.body);
};

// Answers a request to read an event type, through whichever API it came.
const answerReadEventType = (request: FakeRequest, response: ServerResponse): void => {
	const apiVersion: ApiVersion = request.path.startsWith('/api/v2/') ? 'v2' : 'v1';
	const { contentType, body } = answers[apiVersion].readEventType;

	writeHead(response, 200, contentType);
	response.end(body);
};

interface FailedProbe {
	name: string;
	answer: (response: ServerResponse) => void;
	isError: (error: unknown) => boolean;
}

const expectedEventType: EventType = { type: 'io.eventsourcingdb.test', hasEvents: true };

suite('detectApiVersion', { timeout: 30_000 }, () => {
	let server: FakeServer;
	let client: Client;
	let probeAnswers: ((response: ServerResponse) => void)[];

	beforeEach(async () => {
		// The server leaves the probe to the test, which answers it with the next
		// of the probe answers, and as a v2 server once there are none left.
		server = new FakeServer();
		probeAnswers = [];
		server.respond = (request: FakeRequest, response: ServerResponse): void => {
			if (isProbe(request)) {
				(probeAnswers.shift() ?? answerProbeAsV2)(response);
				return;
			}

			answerReadEventType(request, response);
		};
		await server.start();

		client = new Client(server.url, 'secret');
	});

	afterEach(async () => {
		await server.stop();
	});

	test('does not send a request when creating a client.', (): void => {
		const originalFetch = globalThis.fetch;
		let fetchCount = 0;
		globalThis.fetch = async (...parameters: Parameters<typeof fetch>): Promise<Response> => {
			fetchCount += 1;
			return await originalFetch(...parameters);
		};

		try {
			assert.ok(new Client(server.url, 'secret'));
		} finally {
			globalThis.fetch = originalFetch;
		}

		assert.equal(fetchCount, 0);
	});

	test('uses the v2 API if the server answers the ping of the v2 API.', async (): Promise<void> => {
		assert.deepEqual(await client.readEventType('io.eventsourcingdb.test'), expectedEventType);

		const [probe, request] = server.requests;
		assert.ok(probe && isProbe(probe));
		assert.equal(request?.method, 'QUERY');
		assert.equal(request?.path, '/api/v2/data/read-event-type');
		assert.equal(request?.body, '{"type":"io.eventsourcingdb.test"}');
	});

	const defineV1Test = (status: number): void => {
		test(`uses the v1 API if the server answers the ping of the v2 API with ${status}.`, async (): Promise<void> => {
			probeAnswers.push((response: ServerResponse): void => {
				answerWithText(
					response,
					status,
					status === 404 ? '404 page not found' : 'Method Not Allowed',
				);
			});

			assert.deepEqual(await client.readEventType('io.eventsourcingdb.test'), expectedEventType);

			const [, request] = server.requests;
			assert.equal(request?.method, 'POST');
			assert.equal(request?.path, '/api/v1/read-event-type');
			assert.equal(request?.body, '{"eventType":"io.eventsourcingdb.test"}');
		});
	};

	for (const status of [404, 405]) {
		defineV1Test(status);
	}

	const defineV1WithoutServerHeaderTest = (status: number): void => {
		test(`uses the v1 API if a proxy answers the ping of the v2 API with ${status} and without the Server header of EventSourcingDB.`, async (): Promise<void> => {
			// A proxy in front of a server that offers only the v1 API may forward
			// only the paths of the v1 API, and answer every other path itself.
			// The request through the v1 API that follows checks the header.
			probeAnswers.push((response: ServerResponse): void => {
				response.writeHead(status, { server: 'nginx', 'content-type': 'text/html' });
				response.end(`<html><body>${status}</body></html>`);
			});

			assert.deepEqual(await client.readEventType('io.eventsourcingdb.test'), expectedEventType);
			assert.equal(server.probeCount, 1);

			const [, request] = server.requests;
			assert.equal(request?.method, 'POST');
			assert.equal(request?.path, '/api/v1/read-event-type');
		});
	};

	for (const status of [404, 405]) {
		defineV1WithoutServerHeaderTest(status);
	}

	const defineRememberTest = (apiVersion: ApiVersion): void => {
		test(`remembers that the server offers the ${apiVersion} API.`, async (): Promise<void> => {
			if (apiVersion === 'v1') {
				probeAnswers.push((response: ServerResponse): void => {
					answerWithText(response, 404, '404 page not found');
				});
			}

			await client.readEventType('io.eventsourcingdb.test');
			await client.readEventType('io.eventsourcingdb.test');
			await client.readEventType('io.eventsourcingdb.test');

			assert.equal(server.probeCount, 1);
			const path = apiVersion === 'v1' ? '/api/v1/read-event-type' : '/api/v2/data/read-event-type';
			assert.deepEqual(
				server.requests.filter(request => !isProbe(request)).map(request => request.path),
				[path, path, path],
			);
		});
	};

	for (const apiVersion of apiVersions) {
		defineRememberTest(apiVersion);
	}

	const failedProbes: FailedProbe[] = [
		{
			name: 'an internal server error',
			answer: (response: ServerResponse): void => {
				answerWithText(response, 500, 'internal server error');
			},
			isError: (error: unknown): boolean =>
				error instanceof DbApiError &&
				error.status === 500 &&
				error.description === 'internal server error' &&
				error.code === undefined,
		},
		{
			name: 'a broken connection',
			answer: (response: ServerResponse): void => {
				response.socket?.destroy();
			},
			isError: (error: unknown): boolean =>
				error instanceof TypeError && error.message === 'fetch failed',
		},
		{
			name: 'an answer that is not a ping',
			answer: (response: ServerResponse): void => {
				writeHead(response, 200, 'text/html');
				response.end('<html></html>');
			},
			isError: (error: unknown): boolean =>
				error instanceof Error &&
				error.message === 'Failed to find out which API the server offers.',
		},
		{
			name: 'an answer that does not come from EventSourcingDB',
			answer: (response: ServerResponse): void => {
				response.writeHead(200, { 'content-type': 'application/json' });
				response.end(answers.v2.ping.body);
			},
			isError: (error: unknown): boolean =>
				error instanceof Error &&
				error.message === 'Server must be EventSourcingDB, but Server header is missing.',
		},
	];

	const defineFailedProbeTest = ({ name, answer, isError }: FailedProbe): void => {
		test(`fails the first request with the error of ${name}, and asks again with the next request.`, async (): Promise<void> => {
			probeAnswers.push(answer);

			await assert.rejects(client.readEventType('io.eventsourcingdb.test'), isError);
			assert.equal(server.probeCount, 1);
			assert.equal(server.requests.filter(request => !isProbe(request)).length, 0);

			assert.deepEqual(await client.readEventType('io.eventsourcingdb.test'), expectedEventType);
			assert.equal(server.probeCount, 2);

			await client.readEventType('io.eventsourcingdb.test');
			assert.equal(server.probeCount, 2);
		});
	};

	for (const failedProbe of failedProbes) {
		defineFailedProbeTest(failedProbe);
	}

	test('asks once for requests that start while it finds out which API the server offers.', async (): Promise<void> => {
		const eventTypes = await Promise.all([
			client.readEventType('io.eventsourcingdb.test'),
			client.readEventType('io.eventsourcingdb.test'),
			client.readEventType('io.eventsourcingdb.test'),
		]);

		assert.deepEqual(eventTypes, [expectedEventType, expectedEventType, expectedEventType]);
		assert.equal(server.probeCount, 1);
	});

	test('fails every request that waits for the same answer, if it fails.', async (): Promise<void> => {
		probeAnswers.push((response: ServerResponse): void => {
			answerWithText(response, 503, 'server is shutting down');
		});

		const isError = (error: unknown): boolean =>
			error instanceof DbApiError && error.status === 503;

		await Promise.all([
			assert.rejects(client.readEventType('io.eventsourcingdb.test'), isError),
			assert.rejects(client.readEventType('io.eventsourcingdb.test'), isError),
		]);
		assert.equal(server.probeCount, 1);
	});

	suite('while it finds out which API the server offers', () => {
		let probeArrived: PromiseWithResolvers<ServerResponse>;

		beforeEach(() => {
			probeArrived = Promise.withResolvers<ServerResponse>();
			probeAnswers.push((response: ServerResponse): void => {
				probeArrived.resolve(response);
			});
		});

		test('fails the request of a caller that aborts, and goes on for the others.', async (): Promise<void> => {
			const controller = new AbortController();
			const aborted = client.readEventType('io.eventsourcingdb.test', controller.signal);
			const notAborted = client.readEventType('io.eventsourcingdb.test');

			const probeResponse = await probeArrived.promise;
			controller.abort();
			await assert.rejects(
				aborted,
				(error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError',
			);

			answerProbeAsV2(probeResponse);
			assert.deepEqual(await notAborted, expectedEventType);
			assert.equal(server.probeCount, 1);
		});

		test('fails a write of a caller that aborts with the abort error, since it was not sent.', async (): Promise<void> => {
			const controller = new AbortController();
			const written = client.writeEvents(
				[
					{
						source: 'https://www.eventsourcingdb.io',
						subject: '/test',
						type: 'io.eventsourcingdb.test',
						data: {},
					},
				],
				[],
				controller.signal,
			);

			await probeArrived.promise;
			controller.abort();

			await assert.rejects(
				written,
				(error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError',
			);
			assert.equal(server.requests.filter(request => !isProbe(request)).length, 0);
		});

		test('ends a stream without an error if the caller aborts.', async (): Promise<void> => {
			const controller = new AbortController();
			const eventsRead: unknown[] = [];
			const reading = (async (): Promise<void> => {
				for await (const event of client.readEvents('/', { recursive: true }, controller.signal)) {
					eventsRead.push(event);
				}
			})();

			await probeArrived.promise;
			controller.abort();
			await reading;

			assert.deepEqual(eventsRead, []);
		});
	});
});
