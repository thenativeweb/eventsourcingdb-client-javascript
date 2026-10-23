import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import type { ApiVersion } from './detectApiVersion.js';
import type { EventCandidate } from './EventCandidate.js';
import { IncompatibleServerError } from './IncompatibleServerError.js';
import { isEventQlQueryTrue } from './isEventQlQueryTrue.js';
import { isSubjectOnEventId } from './isSubjectOnEventId.js';
import { isSubjectPopulated } from './isSubjectPopulated.js';
import { isSubjectPristine } from './isSubjectPristine.js';
import type { Precondition } from './Precondition.js';
import type { PreconditionOptions } from './PreconditionOptions.js';
import { answers } from './testing/answers.js';
import { type FakeRequest, FakeServer, writeHead } from './testing/FakeServer.js';
import { isRecord } from './types/isRecord.js';

const event: EventCandidate = {
	source: 'https://www.eventsourcingdb.io',
	subject: '/test',
	type: 'io.eventsourcingdb.test',
	data: { value: 23 },
};

interface PreconditionOnSubject {
	name: string;
	create: (options?: PreconditionOptions) => Precondition;

	// The payload that the precondition has without options.
	payload: Record<string, unknown>;
}

const preconditionsOnSubject: PreconditionOnSubject[] = [
	{
		name: 'isSubjectPristine',
		create: (options?: PreconditionOptions): Precondition => isSubjectPristine('/test', options),
		payload: { subject: '/test' },
	},
	{
		name: 'isSubjectPopulated',
		create: (options?: PreconditionOptions): Precondition => isSubjectPopulated('/test', options),
		payload: { subject: '/test' },
	},
	{
		name: 'isSubjectOnEventId',
		create: (options?: PreconditionOptions): Precondition =>
			isSubjectOnEventId('/test', '0', options),
		payload: { subject: '/test', eventId: '0' },
	},
];

// Reads the preconditions that a write sent, as the server received them.
const getSentPreconditions = (request: FakeRequest | undefined): unknown => {
	const body: unknown = JSON.parse(request?.body ?? 'null');
	return isRecord(body) ? body.preconditions : undefined;
};

const isIncompatibleServerError = (error: unknown): boolean =>
	error instanceof IncompatibleServerError &&
	error.name === 'IncompatibleServerError' &&
	error.message === 'The server does not offer the v2 API, which a recursive precondition needs.';

suite('preconditionOptions', { timeout: 30_000 }, () => {
	let server: FakeServer;
	let client: Client;

	const startServer = async (apiVersion: ApiVersion): Promise<void> => {
		server = new FakeServer(apiVersion);
		server.respond = (_request: FakeRequest, response: ServerResponse): void => {
			const { contentType, body } = answers[apiVersion].writeEvents;

			writeHead(response, 200, contentType);
			response.end(body);
		};
		await server.start();

		client = new Client(server.url, 'secret');
	};

	afterEach(async () => {
		await server.stop();
	});

	suite('v2', () => {
		beforeEach(async () => {
			await startServer('v2');
		});

		const defineRecursiveTestFor = (
			{ name, create, payload }: PreconditionOnSubject,
			recursive: boolean,
		): void => {
			test(`sends the recursive option as ${recursive}.`, async (): Promise<void> => {
				await client.writeEvents([event], [create({ recursive })]);

				const [request] = server.requests;
				assert.equal(request?.path, '/api/v2/data/write-events');
				assert.deepEqual(getSentPreconditions(request), [
					{ type: name, payload: { ...payload, options: { recursive } } },
				]);
			});
		};

		const defineTestsFor = (preconditionOnSubject: PreconditionOnSubject): void => {
			const { name, create, payload } = preconditionOnSubject;

			suite(name, () => {
				for (const recursive of [true, false]) {
					defineRecursiveTestFor(preconditionOnSubject, recursive);
				}

				test('sends the precondition without options if it has none.', async (): Promise<void> => {
					await client.writeEvents([event], [create()]);

					const [request] = server.requests;
					assert.deepEqual(getSentPreconditions(request), [{ type: name, payload }]);
				});

				test('sends the options as the caller passed them, so that the server refuses a misspelled key.', async (): Promise<void> => {
					// A caller without types may pass options that the types do not
					// allow.
					const precondition: Precondition = Reflect.apply(create, undefined, [{ recursiv: true }]);
					await client.writeEvents([event], [precondition]);

					const [request] = server.requests;
					assert.deepEqual(getSentPreconditions(request), [
						{ type: name, payload: { ...payload, options: { recursiv: true } } },
					]);
				});
			});
		};

		for (const preconditionOnSubject of preconditionsOnSubject) {
			defineTestsFor(preconditionOnSubject);
		}
	});

	suite('v1', () => {
		beforeEach(async () => {
			await startServer('v1');
		});

		const defineTestsFor = ({ name, create, payload }: PreconditionOnSubject): void => {
			suite(name, () => {
				test('fails without sending the write if the precondition is recursive, since the v1 API cannot check it.', async (): Promise<void> => {
					await assert.rejects(
						client.writeEvents([event], [create({ recursive: true })]),
						isIncompatibleServerError,
					);

					assert.deepEqual(server.requests, []);
				});

				test('fails without sending the write if any of its preconditions is recursive.', async (): Promise<void> => {
					await assert.rejects(
						client.writeEvents(
							[event],
							[
								isEventQlQueryTrue('FROM e IN events PROJECT INTO COUNT() == 0'),
								create({ recursive: false }),
								create({ recursive: true }),
							],
						),
						isIncompatibleServerError,
					);

					assert.deepEqual(server.requests, []);
				});

				test('fails without sending the write if the options are anything but recursive set to false, since they may have been meant as recursive.', async (): Promise<void> => {
					for (const options of [
						{},
						{ recursiv: false },
						{ recursive: 'false' },
						{ recursive: 0 },
						{ recursive: false, recursiv: true },
						null,
					]) {
						// A caller without types may pass options that the types do not
						// allow.
						const precondition: Precondition = Reflect.apply(create, undefined, [options]);

						await assert.rejects(
							client.writeEvents([event], [precondition]),
							isIncompatibleServerError,
							`Options ${JSON.stringify(options)} must be refused.`,
						);
					}

					assert.deepEqual(server.requests, []);
				});

				test('sends a precondition that is not recursive as one without options.', async (): Promise<void> => {
					await client.writeEvents([event], [create({ recursive: false })]);

					const [request] = server.requests;
					assert.equal(request?.path, '/api/v1/write-events');
					assert.deepEqual(getSentPreconditions(request), [{ type: name, payload }]);
				});

				test('sends the precondition without options if it has none.', async (): Promise<void> => {
					await client.writeEvents([event], [create()]);

					const [request] = server.requests;
					assert.deepEqual(getSentPreconditions(request), [{ type: name, payload }]);
				});
			});
		};

		for (const preconditionOnSubject of preconditionsOnSubject) {
			defineTestsFor(preconditionOnSubject);
		}
	});
});
