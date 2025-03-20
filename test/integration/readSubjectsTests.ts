import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import type { Client } from '../../lib/index.js';
import { CancelationError, EventCandidate } from '../../lib/index.js';
import { ClientError } from '../../lib/util/error/ClientError.js';
import { ServerError } from '../../lib/util/error/ServerError.js';
import type { Database } from '../shared/Database.js';
import { buildDatabase } from '../shared/buildDatabase.js';
import { events } from '../shared/events/events.js';
import { testSource } from '../shared/events/source.js';
import { startDatabase } from '../shared/startDatabase.js';
import { startLocalHttpServer } from '../shared/startLocalHttpServer.js';
import { stopDatabase } from '../shared/stopDatabase.js';

suite('readSubjects', { timeout: 20_000 }, () => {
	let database: Database;

	before(() => {
		buildDatabase('test/shared/docker/eventsourcingdb');
	});

	beforeEach(async () => {
		database = await startDatabase();
	});

	afterEach(() => {
		stopDatabase(database);
	});

	test('throws an error when trying to read from a non-reachable server.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert.rejects(async () => {
			const readSubjectsResult = client.readSubjects(new AbortController(), { baseSubject: '/' });

			for await (const _ of readSubjectsResult) {
				// Intentionally left blank.
			}
		});
	});

	test('supports authorization.', async (): Promise<void> => {
		const client = database.withAuthorization.client;
		// Should not throw.
		const readSubjectsResult = client.readSubjects(new AbortController(), { baseSubject: '/' });

		for await (const _ of readSubjectsResult) {
			// Intentionally left blank.
		}
	});

	test('reads all subjects starting from /.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await client.writeEvents([
			new EventCandidate(testSource, '/foo', events.loggedIn.janeDoe.type, {}),
		]);

		const actualSubjects: string[] = [];

		const readSubjectsResult = client.readSubjects(new AbortController(), { baseSubject: '/' });

		for await (const subject of readSubjectsResult) {
			actualSubjects.push(subject);
		}

		assert.deepEqual(actualSubjects, ['/', '/foo']);
	});

	test('reads all subjects starting from the given base subject.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await client.writeEvents([
			new EventCandidate(testSource, '/foo/bar', events.loggedIn.janeDoe.type, {}),
		]);

		const actualSubjects: string[] = [];

		const readSubjectsResult = client.readSubjects(new AbortController(), { baseSubject: '/foo' });

		for await (const subject of readSubjectsResult) {
			actualSubjects.push(subject);
		}

		assert.deepEqual(actualSubjects, ['/foo', '/foo/bar']);
	});

	test('throws an error when the AbortController is aborted.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		const abortController = new AbortController();

		await assert.rejects(
			async () => {
				const readSubjectsResult = client.readSubjects(abortController, { baseSubject: '/' });
				abortController.abort();

				for await (const _ of readSubjectsResult) {
					// Intentionally left blank.
				}
			},
			error => {
				assert.ok(error instanceof CancelationError);
				return true;
			},
		);
	});

	test('throws an error if the base subject is malformed.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert.rejects(
			async () => {
				const readSubjectsResult = client.readSubjects(new AbortController(), { baseSubject: '' });

				for await (const _ of readSubjectsResult) {
					// Intentionally left blank.
				}
			},
			{
				message:
					"Parameter 'options' is invalid: Failed to validate subject: '' must be an absolute, slash-separated path.",
			},
		);
	});

	suite('with a mock server', () => {
		let stopServer: () => Promise<void>;

		afterEach(async () => {
			await stopServer();
		});

		test('throws a server error if the server responds with http 5xx on every try.', async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/read-subjects', (_req, res) => {
					res.status(StatusCodes.BAD_GATEWAY);
					res.send(ReasonPhrases.BAD_GATEWAY);
				});
			}));

			const result = client.readSubjects(new AbortController(), { baseSubject: '/' });

			await assert.rejects(
				async () => {
					for await (const _item of result) {
						// Intentionally left blank.
					}
				},
				error => {
					assert.ok(error instanceof ServerError);
					assert.equal(
						error.message,
						"Server error occurred: Request failed with status code '502'.",
					);
					return true;
				},
			);
		});

		test("throws an error if the server's protocol version does not match.", async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/read-subjects', (_req, res) => {
					res.setHeader('X-EventSourcingDB-Protocol-Version', '0.0.0');
					res.status(StatusCodes.UNPROCESSABLE_ENTITY);
					res.send(ReasonPhrases.UNPROCESSABLE_ENTITY);
				});
			}));

			const result = client.readSubjects(new AbortController(), { baseSubject: '/' });

			await assert.rejects(
				async () => {
					for await (const _item of result) {
						// Intentionally left blank.
					}
				},
				error => {
					assert.ok(error instanceof ClientError);
					assert.equal(
						error.message,
						"Client error occurred: Protocol version mismatch, server '0.0.0', client '1.0.0.'",
					);
					return true;
				},
			);
		});

		test('throws a client error if the server returns a 4xx status code.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/read-subjects', (_req, res) => {
					res.status(StatusCodes.IM_A_TEAPOT);
					res.send(ReasonPhrases.IM_A_TEAPOT);
				});
			}));

			const result = client.readSubjects(new AbortController(), { baseSubject: '/' });

			await assert.rejects(
				async () => {
					for await (const _item of result) {
						// Intentionally left blank.
					}
				},
				error => {
					assert.ok(error instanceof ClientError);
					assert.equal(
						error.message,
						"Client error occurred: Request failed with status code '418'.",
					);
					return true;
				},
			);
		});

		test('returns a server error if the server returns a non 200, 5xx or 4xx status code.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/read-subjects', (_req, res) => {
					res.status(StatusCodes.ACCEPTED);
					res.send(ReasonPhrases.ACCEPTED);
				});
			}));

			const result = client.readSubjects(new AbortController(), { baseSubject: '/' });

			await assert.rejects(
				async () => {
					for await (const _item of result) {
						// Intentionally left blank.
					}
				},
				error => {
					assert.ok(error instanceof ServerError);
					assert.equal(
						error.message,
						'Server error occurred: Unexpected response status: 202 Accepted.',
					);
					return true;
				},
			);
		});

		test("throws a server error if the server sends a stream item that can't be unmarshalled.", async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/read-subjects', (_req, res) => {
					res.send('utter garbage\n');
				});
			}));

			const result = client.readSubjects(new AbortController(), { baseSubject: '/' });

			await assert.rejects(
				async () => {
					for await (const _item of result) {
						// Intentionally left blank.
					}
				},
				error => {
					assert.ok(error instanceof ServerError);
					assert.equal(error.message, 'Server error occurred: Failed to read response.');
					return true;
				},
			);
		});

		test('throws a server error if the server sends a stream item with unsupported type.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/read-subjects', (_req, res) => {
					res.send('{"type": ":clown:"}\n');
				});
			}));

			const result = client.readSubjects(new AbortController(), { baseSubject: '/' });

			await assert.rejects(
				async () => {
					for await (const _item of result) {
						// Intentionally left blank.
					}
				},
				error => {
					assert.ok(error instanceof ServerError);
					assert.equal(
						error.message,
						'Server error occurred: Failed to read subjects, an unexpected stream item was received: \'{"type":":clown:"}\'.',
					);
					return true;
				},
			);
		});

		test('throws a server error if the server sends a an error item through the ndjson stream.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/read-subjects', (_req, res) => {
					res.send('{"type": "error", "payload": { "error": "not enough JUICE 😩." }}\n');
				});
			}));

			const result = client.readSubjects(new AbortController(), { baseSubject: '/' });

			await assert.rejects(
				async () => {
					for await (const _item of result) {
						// Intentionally left blank.
					}
				},
				error => {
					assert.ok(error instanceof ServerError);
					assert.equal(error.message, 'Server error occurred: not enough JUICE 😩.');
					return true;
				},
			);
		});

		test("throws a server error if the server sends a an error item through the ndjson stream, but the error can't be unmarshalled.", async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/read-subjects', (_req, res) => {
					res.send('{"type": "error", "payload": 42}\n');
				});
			}));

			const result = client.readSubjects(new AbortController(), { baseSubject: '/' });

			await assert.rejects(
				async () => {
					for await (const _item of result) {
						// Intentionally left blank.
					}
				},
				error => {
					assert.ok(error instanceof ServerError);
					assert.equal(
						error.message,
						'Server error occurred: Failed to read subjects, an unexpected stream item was received: \'{"type":"error","payload":42}\'.',
					);
					return true;
				},
			);
		});
	});
});
