import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { Client } from './Client.js';
import { DbApiError } from './DbApiError.js';
import { ErrorCode } from './ErrorCode.js';
import { apiVersions, lines } from './testing/answers.js';
import {
	answerWithText,
	type FakeRequest,
	FakeServer,
	toLine,
	writeHead,
} from './testing/FakeServer.js';

const ndJson = 'application/x-ndjson';

const errorItem: Record<string, unknown> = {
	type: 'error',
	data: {
		code: ErrorCode.eventTypeUnknown,
		description: 'event type is unknown: it has neither events nor a registered schema',
		details: { value: 'io.eventsourcingdb.test' },
	},
};

const isErrorItem = (error: unknown): boolean =>
	error instanceof DbApiError &&
	error.status === 200 &&
	error.code === ErrorCode.eventTypeUnknown &&
	error.description === 'event type is unknown: it has neither events nor a registered schema' &&
	error.message === error.description &&
	isDeepStrictEqual(error.details, { value: 'io.eventsourcingdb.test' }) &&
	error.retryAfter === undefined;

interface RetryAfterCase {
	name: string;
	status: number;
	retryAfter: string | undefined;
	expected: number | undefined;
}

suite('DbApiError', { timeout: 30_000 }, () => {
	test('names the status in its message if the server sent no description.', (): void => {
		const error = new DbApiError({ status: 500, description: '' });

		assert.equal(error.message, "The server answered with HTTP status code '500'.");
		assert.equal(error.code, undefined);
		assert.deepEqual(error.details, {});
	});

	suite('v2', () => {
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

		test('describes an error item that is the single answer.', async (): Promise<void> => {
			server.respond = (_request: FakeRequest, response: ServerResponse): void => {
				writeHead(response, 200, 'application/json');
				response.end(JSON.stringify(errorItem));
			};

			await assert.rejects(client.readEventType('io.eventsourcingdb.test'), isErrorItem);
		});

		test('describes an error item of a stream.', async (): Promise<void> => {
			server.respond = (_request: FakeRequest, response: ServerResponse): void => {
				writeHead(response, 200, ndJson);
				response.end(`${lines.v2.heartbeat}${toLine(errorItem)}${lines.v2.end}`);
			};

			await assert.rejects(async () => {
				for await (const _event of client.readEvents('/', { recursive: true })) {
					// Intentionally left blank.
				}
			}, isErrorItem);
		});

		test('describes an error item that a write sends after its heartbeats.', async (): Promise<void> => {
			server.respond = (_request: FakeRequest, response: ServerResponse): void => {
				writeHead(response, 200, ndJson);
				response.end(`${lines.v2.heartbeat}${toLine(errorItem)}${lines.v2.end}`);
			};

			await assert.rejects(
				client.writeEvents([
					{
						source: 'https://www.eventsourcingdb.io',
						subject: '/test',
						type: 'io.eventsourcingdb.test',
						data: {},
					},
				]),
				isErrorItem,
			);
		});

		test('describes an answer with a status other than 200 by its text, without a code.', async (): Promise<void> => {
			server.respond = (_request: FakeRequest, response: ServerResponse): void => {
				answerWithText(response, 400, '/subject: unknown field');
			};

			await assert.rejects(client.readEventType('io.eventsourcingdb.test'), (error: unknown) => {
				assert.ok(error instanceof DbApiError);
				assert.equal(error.status, 400);
				assert.equal(error.description, '/subject: unknown field');
				assert.equal(error.code, undefined);
				assert.deepEqual(error.details, {});

				return true;
			});
		});
	});

	for (const apiVersion of apiVersions) {
		suite(`retryAfter (${apiVersion})`, () => {
			let server: FakeServer;
			let client: Client;

			beforeEach(async () => {
				server = new FakeServer(apiVersion);
				await server.start();

				client = new Client(server.url, 'secret');
			});

			afterEach(async () => {
				await server.stop();
			});

			const cases: RetryAfterCase[] = [
				{ name: 'names the seconds', status: 429, retryAfter: '7', expected: 7 },
				{
					name: 'is undefined without the header',
					status: 429,
					retryAfter: undefined,
					expected: undefined,
				},
				{
					name: 'is undefined for a header that does not name seconds',
					status: 429,
					retryAfter: 'soon',
					expected: undefined,
				},
				{
					name: 'is undefined for a status other than 429',
					status: 503,
					retryAfter: '7',
					expected: undefined,
				},
			];

			const defineTestFor = ({ name, status, retryAfter, expected }: RetryAfterCase): void => {
				test(`${name}.`, async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						response.writeHead(status, {
							server: 'EventSourcingDB/test',
							'content-type': 'text/plain; charset=utf-8',
							...(retryAfter === undefined ? {} : { 'retry-after': retryAfter }),
						});
						response.end('too many requests\n');
					};

					await assert.rejects(
						client.readEventType('io.eventsourcingdb.test'),
						(error: unknown) => {
							assert.ok(error instanceof DbApiError);
							assert.equal(error.status, status);
							assert.equal(error.description, 'too many requests');
							assert.equal(error.retryAfter, expected);

							return true;
						},
					);

					// The client never repeats a request on its own.
					assert.equal(server.requests.length, 1);
				});
			};

			for (const retryAfterCase of cases) {
				defineTestFor(retryAfterCase);
			}
		});
	}

	suite('v1', () => {
		let server: FakeServer;
		let client: Client;

		beforeEach(async () => {
			server = new FakeServer('v1');
			await server.start();

			client = new Client(server.url, 'secret');
		});

		afterEach(async () => {
			await server.stop();
		});

		test('describes an error item of a stream by its text, without a code.', async (): Promise<void> => {
			server.respond = (_request: FakeRequest, response: ServerResponse): void => {
				writeHead(response, 200, ndJson);
				response.end(lines.v1.error('unexpected error'));
			};

			await assert.rejects(
				async () => {
					for await (const _row of client.runEventQlQuery('FROM e IN events PROJECT INTO e')) {
						// Intentionally left blank.
					}
				},
				(error: unknown) => {
					assert.ok(error instanceof DbApiError);
					assert.equal(error.status, 200);
					assert.equal(error.description, 'unexpected error');
					assert.equal(error.code, undefined);
					assert.deepEqual(error.details, {});

					return true;
				},
			);
		});
	});
});
