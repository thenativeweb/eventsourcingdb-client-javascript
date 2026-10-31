import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { DbApiError } from './DbApiError.js';
import type { ApiVersion } from './detectApiVersion.js';
import { OutcomeUnknownError } from './OutcomeUnknownError.js';
import { type Answer, answers, lines } from './testing/answers.js';
import { answerWithText, type FakeRequest, FakeServer, writeHead } from './testing/FakeServer.js';

const json = 'application/json';
const ndJson = 'application/x-ndjson';

const isProbe = (request: FakeRequest): boolean =>
	request.method === 'GET' && request.path === '/api/v2/system/ping';

const getApiVersion = (request: FakeRequest): ApiVersion =>
	request.path.startsWith('/api/v2/') ? 'v2' : 'v1';

const consume = async (iterator: AsyncGenerator<unknown, void, void>): Promise<unknown[]> => {
	const items: unknown[] = [];
	for await (const item of iterator) {
		items.push(item);
	}
	return items;
};

// Answers as a server without the v2 API answers a path of it.
const answerAsNotOffered = (response: ServerResponse, status: number): void => {
	answerWithText(response, status, status === 404 ? '404 page not found' : 'Method Not Allowed');
};

const answerWith = (response: ServerResponse, { contentType, body }: Answer): void => {
	writeHead(response, 200, contentType);
	response.end(body);
};

interface Call {
	name: string;
	run: (client: Client) => Promise<unknown>;
	paths: Record<ApiVersion, string>;
	answers: Record<ApiVersion, Answer>;
	isWrite: boolean;
}

const readEventType: Call = {
	name: 'readEventType',
	run: async (client: Client): Promise<unknown> =>
		await client.readEventType('io.eventsourcingdb.test'),
	paths: { v1: '/api/v1/read-event-type', v2: '/api/v2/data/read-event-type' },
	answers: { v1: answers.v1.readEventType, v2: answers.v2.readEventType },
	isWrite: false,
};

// A single answer, streams with and without an end, a write, and the
// registration of an event schema, each of which reads its answer differently.
const calls: Call[] = [
	readEventType,
	{
		name: 'readEvents',
		run: async (client: Client): Promise<unknown> =>
			await consume(client.readEvents('/', { recursive: true })),
		paths: { v1: '/api/v1/read-events', v2: '/api/v2/data/read-events' },
		answers: {
			v1: { contentType: ndJson, body: lines.v1.event('0') },
			v2: { contentType: ndJson, body: `${lines.v2.event('0')}${lines.v2.end}` },
		},
		isWrite: false,
	},
	{
		name: 'observeEvents',
		run: async (client: Client): Promise<unknown> => {
			// Observing never ends on its own, so the call stops after the first
			// event.
			for await (const event of client.observeEvents('/', { recursive: true })) {
				return event.id;
			}

			throw new Error('Failed to observe an event.');
		},
		paths: { v1: '/api/v1/observe-events', v2: '/api/v2/data/observe-events' },
		answers: {
			v1: { contentType: ndJson, body: lines.v1.event('0') },
			v2: { contentType: ndJson, body: lines.v2.event('0') },
		},
		isWrite: false,
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
		paths: { v1: '/api/v1/write-events', v2: '/api/v2/data/write-events' },
		answers: { v1: answers.v1.writeEvents, v2: answers.v2.writeEvents },
		isWrite: true,
	},
	{
		name: 'registerEventSchema',
		run: async (client: Client): Promise<unknown> =>
			await client.registerEventSchema('io.eventsourcingdb.test', { type: 'object' }),
		paths: { v1: '/api/v1/register-event-schema', v2: '/api/v2/data/register-event-schema' },
		answers: {
			// Registering an event schema through the v1 API does not read the
			// answer.
			v1: { contentType: json, body: '{}' },
			v2: answers.v2.registerEventSchema ?? { contentType: ndJson, body: '' },
		},
		isWrite: true,
	},
];

const isDbApiErrorWithStatus =
	(status: number) =>
	(error: unknown): boolean =>
		error instanceof DbApiError && error.status === status;

// A call fails as before with the error of the server, which a write wraps in
// an OutcomeUnknownError, since the v2 API does not refuse a write with 404 or
// 405.
const isFailureOf =
	({ isWrite }: Call, status: number) =>
	(error: unknown): boolean => {
		if (!isWrite) {
			return isDbApiErrorWithStatus(status)(error);
		}

		return error instanceof OutcomeUnknownError && isDbApiErrorWithStatus(status)(error.cause);
	};

// A call fails with the error of the server, which a write wraps in an
// OutcomeUnknownError, unless the server refused it.
const isFailureWithStatus =
	(status: number) =>
	(error: unknown): boolean =>
		isDbApiErrorWithStatus(status)(error instanceof OutcomeUnknownError ? error.cause : error);

interface KeptAnswer {
	name: string;
	status: number;
	answer: (call: Call, response: ServerResponse) => void;
}

// The answers with which a call through the v2 API fails, although the server
// still offers the v2 API.
const keptAnswers: KeptAnswer[] = [
	{
		name: 'an error item of the v2 API, which comes with the status 200',
		status: 200,
		answer: (call: Call, response: ServerResponse): void => {
			answerWith(response, {
				contentType: call.answers.v2.contentType,
				body: lines.v2.error('the store is read-only'),
			});
		},
	},
	...[409, 500, 503].map(
		(status): KeptAnswer => ({
			name: `the status ${status} of the v2 API`,
			status,
			answer: (_call: Call, response: ServerResponse): void => {
				answerWithText(response, status, 'failed');
			},
		}),
	),
];

suite('a server that is rolled back to a version without the v2 API', { timeout: 30_000 }, () => {
	let server: FakeServer;
	let client: Client;
	let offersV2: boolean;

	const getPaths = (): string[] =>
		server.requests.filter(request => !isProbe(request)).map(request => request.path);

	// The server answers the first probe itself, as a server that offers the v2
	// API. Once the test rolls it back, it answers every path of the v2 API as a
	// server without it.
	const respondTo =
		(call: Call, notOfferedStatus = 404) =>
		(request: FakeRequest, response: ServerResponse): void => {
			if (isProbe(request)) {
				answerAsNotOffered(response, 404);
				return;
			}

			const apiVersion = getApiVersion(request);
			if (apiVersion === 'v2' && !offersV2) {
				answerAsNotOffered(response, notOfferedStatus);
				return;
			}

			answerWith(response, call.answers[apiVersion]);
		};

	beforeEach(async () => {
		server = new FakeServer('v2');
		offersV2 = true;
		await server.start();

		client = new Client(server.url, 'secret');
	});

	afterEach(async () => {
		await server.stop();
	});

	const defineForgetTest = (call: Call, status: number): void => {
		test(`fails once with the status ${status} of the v2 API, and finds out again which API the server offers with the next request.`, async (): Promise<void> => {
			server.respond = respondTo(call, status);

			await call.run(client);
			offersV2 = false;

			await assert.rejects(call.run(client), isFailureOf(call, status));
			assert.equal(server.probeCount, 1);

			await call.run(client);
			assert.equal(server.probeCount, 2);
			assert.deepEqual(getPaths(), [call.paths.v2, call.paths.v2, call.paths.v1]);
		});
	};

	const defineKeepTest = (call: Call, { name, status, answer }: KeptAnswer): void => {
		test(`keeps the API after ${name}.`, async (): Promise<void> => {
			server.respond = respondTo(call);
			await call.run(client);

			server.respond = (_request: FakeRequest, response: ServerResponse): void => {
				answer(call, response);
			};
			await assert.rejects(call.run(client), isFailureWithStatus(status));

			server.respond = respondTo(call);
			await call.run(client);
			assert.equal(server.probeCount, 1);

			// The same client forgets the API once the server is rolled back.
			offersV2 = false;
			await assert.rejects(call.run(client), isFailureOf(call, 404));
			await call.run(client);
			assert.equal(server.probeCount, 2);
			assert.deepEqual(getPaths(), [
				call.paths.v2,
				call.paths.v2,
				call.paths.v2,
				call.paths.v2,
				call.paths.v1,
			]);
		});
	};

	for (const call of calls) {
		suite(call.name, () => {
			for (const status of [404, 405]) {
				defineForgetTest(call, status);
			}

			for (const keptAnswer of keptAnswers) {
				defineKeepTest(call, keptAnswer);
			}
		});
	}

	test('keeps the API after the status 404 of the v1 API, which it uses once the server is rolled back.', async (): Promise<void> => {
		server.respond = respondTo(readEventType);
		await readEventType.run(client);
		offersV2 = false;
		await assert.rejects(readEventType.run(client), isDbApiErrorWithStatus(404));
		await readEventType.run(client);

		// Through the v1 API, 404 is an error such as an unknown event type.
		server.respond = (_request: FakeRequest, response: ServerResponse): void => {
			answerWithText(response, 404, 'event type not found');
		};
		await assert.rejects(
			readEventType.run(client),
			(error: unknown): boolean =>
				error instanceof DbApiError &&
				error.status === 404 &&
				error.description === 'event type not found',
		);

		server.respond = respondTo(readEventType);
		await readEventType.run(client);
		assert.equal(server.probeCount, 2);
		assert.deepEqual(getPaths(), [
			readEventType.paths.v2,
			readEventType.paths.v2,
			readEventType.paths.v1,
			readEventType.paths.v1,
			readEventType.paths.v1,
		]);
	});

	suite('while it finds out again which API the server offers', () => {
		let heldRequests: PromiseWithResolvers<ServerResponse>[];
		let heldProbe: PromiseWithResolvers<ServerResponse>;

		// The server holds the requests of the v2 API once it is rolled back, and
		// the next probe, so that the test answers them in an order of its own.
		// Every probe after that one finds the v1 API at once, so a probe too many
		// shows in the number of probes.
		beforeEach(async () => {
			heldRequests = [];
			heldProbe = Promise.withResolvers<ServerResponse>();
			let isProbeHeld = false;
			const respond = respondTo(readEventType);
			server.respond = (request: FakeRequest, response: ServerResponse): void => {
				if (isProbe(request) && !isProbeHeld) {
					isProbeHeld = true;
					heldProbe.resolve(response);
					return;
				}
				if (!isProbe(request) && getApiVersion(request) === 'v2' && !offersV2) {
					heldRequests.shift()?.resolve(response);
					return;
				}

				respond(request, response);
			};

			await readEventType.run(client);
			offersV2 = false;
		});

		// Each request has to arrive before the next one starts, so that the test
		// knows which answer belongs to which request.
		const sendHeld = async (): Promise<[Promise<unknown>, ServerResponse]> => {
			const held = Promise.withResolvers<ServerResponse>();
			heldRequests.push(held);
			const result = readEventType.run(client);

			return [result, await held.promise];
		};

		test('shares the probe, and keeps its answer, if requests of the v2 API that started before fail with 404 meanwhile.', async (): Promise<void> => {
			const [failsFirst, firstResponse] = await sendHeld();
			const [failsDuringProbe, duringProbeResponse] = await sendHeld();
			const [failsAfterProbe, afterProbeResponse] = await sendHeld();

			answerAsNotOffered(firstResponse, 404);
			await assert.rejects(failsFirst, isDbApiErrorWithStatus(404));

			const waitingBefore = readEventType.run(client);
			const probeResponse = await heldProbe.promise;

			answerAsNotOffered(duringProbeResponse, 404);
			await assert.rejects(failsDuringProbe, isDbApiErrorWithStatus(404));

			const waitingAfter = readEventType.run(client);
			answerAsNotOffered(probeResponse, 404);
			await Promise.all([waitingBefore, waitingAfter]);

			answerAsNotOffered(afterProbeResponse, 404);
			await assert.rejects(failsAfterProbe, isDbApiErrorWithStatus(404));

			await readEventType.run(client);
			assert.equal(server.probeCount, 2);
			assert.deepEqual(getPaths(), [
				readEventType.paths.v2,
				readEventType.paths.v2,
				readEventType.paths.v2,
				readEventType.paths.v2,
				readEventType.paths.v1,
				readEventType.paths.v1,
				readEventType.paths.v1,
			]);
		});

		test('keeps the answer of the probe if it finds the v2 API again, and a request of the v2 API that started before fails with 404 afterwards.', async (): Promise<void> => {
			const [failsFirst, firstResponse] = await sendHeld();
			const [failsLate, lateResponse] = await sendHeld();

			answerAsNotOffered(firstResponse, 404);
			await assert.rejects(failsFirst, isDbApiErrorWithStatus(404));

			const waiting = readEventType.run(client);
			const probeResponse = await heldProbe.promise;
			offersV2 = true;
			answerWith(probeResponse, answers.v2.ping);
			await waiting;

			answerAsNotOffered(lateResponse, 404);
			await assert.rejects(failsLate, isDbApiErrorWithStatus(404));

			await readEventType.run(client);
			assert.equal(server.probeCount, 2);
			assert.deepEqual(getPaths(), [
				readEventType.paths.v2,
				readEventType.paths.v2,
				readEventType.paths.v2,
				readEventType.paths.v2,
				readEventType.paths.v2,
			]);
		});
	});
});
