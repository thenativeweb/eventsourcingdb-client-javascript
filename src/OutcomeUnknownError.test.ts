import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { DbApiError } from './DbApiError.js';
import type { ApiVersion } from './detectApiVersion.js';
import { ErrorCode } from './ErrorCode.js';
import { OutcomeUnknownError } from './OutcomeUnknownError.js';
import { answers, apiVersions, lines } from './testing/answers.js';
import {
	answerWithText,
	type FakeRequest,
	FakeServer,
	toLine,
	writeHead,
} from './testing/FakeServer.js';

interface Write {
	name: string;
	run: (client: Client) => Promise<unknown>;
}

const writes: Write[] = [
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
	},
	{
		name: 'registerEventSchema',
		run: async (client: Client): Promise<unknown> =>
			await client.registerEventSchema('io.eventsourcingdb.test', { type: 'object' }),
	},
];

const ndJson = 'application/x-ndjson';

const getErrorItem = (code: string): string =>
	toLine({ type: 'error', data: { code, description: 'refused', details: {} } });

interface Case {
	name: string;
	answer: (response: ServerResponse) => void;
	isCause: (cause: unknown) => boolean;

	// The writes that the case applies to, if not to all of them.
	writes?: string[];
}

const isDbApiErrorWithStatus =
	(status: number) =>
	(error: unknown): boolean =>
		error instanceof DbApiError && error.status === status;

const answerWithStatus =
	(status: number) =>
	(response: ServerResponse): void => {
		answerWithText(response, status, 'failed');
	};

// The server refused the write before storing anything in these cases.
const refusals: Record<ApiVersion, Case[]> = {
	v1: [
		...[400, 401, 404, 409, 413, 429, 503, 507].map(
			(status): Case => ({
				name: `the status ${status}`,
				answer: answerWithStatus(status),
				isCause: isDbApiErrorWithStatus(status),
			}),
		),
	],
	v2: [
		...[400, 401, 408, 413, 429, 503].map(
			(status): Case => ({
				name: `the status ${status}`,
				answer: answerWithStatus(status),
				isCause: isDbApiErrorWithStatus(status),
			}),
		),
		...[
			ErrorCode.preconditionViolated,
			ErrorCode.eventSchemaAlreadyRegistered,
			ErrorCode.storeReadOnly,
		].map(
			(code): Case => ({
				name: `an error item with the code '${code}'`,
				answer: (response: ServerResponse): void => {
					writeHead(response, 200, ndJson);
					response.end(`${lines.v2.heartbeat}${getErrorItem(code)}${lines.v2.end}`);
				},
				isCause: (error: unknown): boolean => error instanceof DbApiError && error.code === code,
			}),
		),
	],
};

// The write may have been stored nonetheless in these cases.
const unknownOutcomes: Record<ApiVersion, Case[]> = {
	v1: [
		...[500, 502, 504].map(
			(status): Case => ({
				name: `the status ${status}`,
				answer: answerWithStatus(status),
				isCause: isDbApiErrorWithStatus(status),
			}),
		),
		{
			name: 'an answer that cannot be parsed',
			answer: (response: ServerResponse): void => {
				writeHead(response, 200, 'application/json');
				response.end('[{');
			},
			isCause: (error: unknown): boolean => error instanceof SyntaxError,

			// Registering an event schema through the v1 API does not read the
			// answer.
			writes: ['writeEvents'],
		},
	],
	v2: [
		...[500, 502, 504].map(
			(status): Case => ({
				name: `the status ${status}`,
				answer: answerWithStatus(status),
				isCause: isDbApiErrorWithStatus(status),
			}),
		),
		{
			name: `an error item with the code '${ErrorCode.storeFailed}'`,
			answer: (response: ServerResponse): void => {
				writeHead(response, 200, ndJson);
				response.end(`${getErrorItem(ErrorCode.storeFailed)}${lines.v2.end}`);
			},
			isCause: (error: unknown): boolean =>
				error instanceof DbApiError && error.code === ErrorCode.storeFailed,
		},
		{
			name: 'a stream that ends without its end item',
			answer: (response: ServerResponse): void => {
				writeHead(response, 200, ndJson);
				response.end(lines.v2.heartbeat);
			},
			isCause: (error: unknown): boolean =>
				error instanceof Error &&
				[
					'Failed to write events, since the stream ended unexpectedly.',
					'Failed to register event schema, since the stream ended unexpectedly.',
				].includes(error.message),
		},
	],
};

// Holds for both APIs.
const sharedUnknownOutcomes: Case[] = [
	{
		name: 'a connection that breaks after the request arrived',
		answer: (response: ServerResponse): void => {
			response.socket?.destroy();
		},
		isCause: (error: unknown): boolean =>
			error instanceof TypeError && error.message === 'fetch failed',
	},
	{
		name: 'an answer that does not come from EventSourcingDB',
		answer: (response: ServerResponse): void => {
			response.writeHead(409, { 'content-type': 'text/plain; charset=utf-8' });
			response.end('conflict\n');
		},
		isCause: (error: unknown): boolean =>
			error instanceof Error &&
			error.message === 'Server must be EventSourcingDB, but Server header is missing.',
	},
];

suite('OutcomeUnknownError', { timeout: 30_000 }, () => {
	for (const apiVersion of apiVersions) {
		suite(apiVersion, () => {
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

			const defineRefusalTest = (run: Write['run'], { name, answer, isCause }: Case): void => {
				test(`fails with the error itself after ${name}, since the write certainly was not stored.`, async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						answer(response);
					};

					await assert.rejects(run(client), isCause);
				});
			};

			const defineUnknownOutcomeTest = (
				run: Write['run'],
				{ name, answer, isCause }: Case,
			): void => {
				test(`fails with an unknown outcome after ${name}.`, async (): Promise<void> => {
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						answer(response);
					};

					await assert.rejects(
						run(client),
						(error: unknown): boolean =>
							error instanceof OutcomeUnknownError &&
							error.name === 'OutcomeUnknownError' &&
							error.message === 'The write may or may not have been stored.' &&
							isCause(error.cause),
					);
				});
			};

			const defineConnectionFailureTest = (run: Write['run']): void => {
				test('fails with the error itself if it cannot establish a connection, since the write certainly was not stored.', async (): Promise<void> => {
					// The client finds out which API the server offers first, so the
					// write is the request that cannot connect.
					server.respond = (_request: FakeRequest, response: ServerResponse): void => {
						writeHead(response, 200, answers[apiVersion].ping.contentType);
						response.end(answers[apiVersion].ping.body);
					};
					await client.ping();
					await server.stop();

					await assert.rejects(
						run(client),
						(error: unknown): boolean =>
							!(error instanceof OutcomeUnknownError) &&
							error instanceof TypeError &&
							error.message === 'fetch failed' &&
							error.cause instanceof Error &&
							'code' in error.cause &&
							error.cause.code === 'ECONNREFUSED',
					);

					// Lets afterEach stop a server again.
					server = new FakeServer(apiVersion);
					await server.start();
				});
			};

			const defineTestsFor = ({ name, run }: Write): void => {
				suite(name, () => {
					for (const refusal of refusals[apiVersion]) {
						defineRefusalTest(run, refusal);
					}

					for (const unknownOutcome of [...unknownOutcomes[apiVersion], ...sharedUnknownOutcomes]) {
						if (unknownOutcome.writes === undefined || unknownOutcome.writes.includes(name)) {
							defineUnknownOutcomeTest(run, unknownOutcome);
						}
					}

					defineConnectionFailureTest(run);
				});
			};

			for (const write of writes) {
				defineTestsFor(write);
			}
		});
	}
});
