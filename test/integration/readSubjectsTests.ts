import { Database } from '../shared/Database';
import { testSource } from '../shared/events/source';
import { Source } from '../../lib/event/Source';
import { buildDatabase } from '../shared/buildDatabase';
import { startDatabase } from '../shared/startDatabase';
import { stopDatabase } from '../shared/stopDatabase';
import { assert } from 'assertthat';
import { Client, EventCandidate } from '../../lib';
import { events } from '../shared/events/events';
import { CancelationError } from '../../lib/util/error/CancelationError';
import { startLocalHttpServer } from '../shared/startLocalHttpServer';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { ServerError } from '../../lib/util/error/ServerError';
import { ClientError } from '../../lib/util/error/ClientError';

suite('Client.readSubjects()', function () {
	this.timeout(20_000);
	let database: Database;
	const source = new Source(testSource);

	suiteSetup(async () => {
		buildDatabase('test/shared/docker/eventsourcingdb');
	});

	setup(async () => {
		database = await startDatabase();
	});

	teardown(async () => {
		await stopDatabase(database);
	});

	test('throws an error when trying to read from a non-reachable server.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert
			.that(async () => {
				const readSubjectsResult = client.readSubjects(new AbortController());

				for await (const _ of readSubjectsResult) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync();
	});

	test('supports authorization.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				const readSubjectsResult = client.readSubjects(new AbortController());

				for await (const _ of readSubjectsResult) {
					// Intentionally left blank.
				}
			})
			.is.not.throwingAsync();
	});

	test('reads all subjects starting from /.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;

		await client.writeEvents([
			new EventCandidate(testSource, '/foo', events.loggedIn.janeDoe.type, {}),
		]);

		const actualSubjects: string[] = [];

		const readSubjectsResult = client.readSubjects(new AbortController());

		for await (const subject of readSubjectsResult) {
			actualSubjects.push(subject);
		}

		assert.that(actualSubjects).is.equalTo(['/', '/foo']);
	});

	test('reads all subjects starting from the given base subject.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;

		await client.writeEvents([
			new EventCandidate(testSource, '/foo/bar', events.loggedIn.janeDoe.type, {}),
		]);

		const actualSubjects: string[] = [];

		const readSubjectsResult = client.readSubjects(new AbortController(), { baseSubject: '/foo' });

		for await (const subject of readSubjectsResult) {
			actualSubjects.push(subject);
		}

		assert.that(actualSubjects).is.equalTo(['/foo', '/foo/bar']);
	});

	test('throws an error when the AbortController is aborted.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;

		const abortController = new AbortController();

		await assert
			.that(async () => {
				const readSubjectsResult = client.readSubjects(abortController);
				abortController.abort();

				for await (const _ of readSubjectsResult) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync((error): boolean => error instanceof CancelationError);
	});

	test('throws an error if the base subject is malformed.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;

		await assert
			.that(async () => {
				const readSubjectsResult = client.readSubjects(new AbortController(), { baseSubject: '' });

				for await (const _ of readSubjectsResult) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				"Parameter 'options' is invalid: Failed to validate subject: '' must be an absolute, slash-separated path.",
			);
	});

	suite('with a mock server', () => {
		let stopServer: () => void;

		teardown(async () => {
			stopServer();
		});

		test('throws a server error if the server responds with http 5xx on every try.', async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/read-subjects', (req, res) => {
					res.status(StatusCodes.BAD_GATEWAY);
					res.send(ReasonPhrases.BAD_GATEWAY);
				});
			}));

			let result = client.readSubjects(new AbortController());

			await assert
				.that(async () => {
					for await (const item of result) {
						// Intentionally left blank.
					}
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ServerError &&
						error.message ===
							'Server error occurred: Failed operation with 2 errors:\n' +
								"Error: Server error occurred: Request failed with status code '502'.\n" +
								"Error: Server error occurred: Request failed with status code '502'.",
				);
		});

		test("throws an error if the server's protocol version does not match.", async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/read-subjects', (req, res) => {
					res.setHeader('X-EventSourcingDB-Protocol-Version', '0.0.0');
					res.status(StatusCodes.UNPROCESSABLE_ENTITY);
					res.send(ReasonPhrases.UNPROCESSABLE_ENTITY);
				});
			}));

			let result = client.readSubjects(new AbortController());

			await assert
				.that(async () => {
					for await (const item of result) {
						// Intentionally left blank.
					}
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ClientError &&
						error.message ===
							"Client error occurred: Protocol version mismatch, server '0.0.0', client '1.0.0.'",
				);
		});

		test('throws a client error if the server returns a 4xx status code.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/read-subjects', (req, res) => {
					res.status(StatusCodes.IM_A_TEAPOT);
					res.send(ReasonPhrases.IM_A_TEAPOT);
				});
			}));

			let result = client.readSubjects(new AbortController());

			await assert
				.that(async () => {
					for await (const item of result) {
						// Intentionally left blank.
					}
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ClientError &&
						error.message === "Client error occurred: Request failed with status code '418'.",
				);
		});

		test('returns a server error if the server returns a non 200, 5xx or 4xx status code.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/read-subjects', (req, res) => {
					res.status(StatusCodes.ACCEPTED);
					res.send(ReasonPhrases.ACCEPTED);
				});
			}));

			let result = client.readSubjects(new AbortController());

			await assert
				.that(async () => {
					for await (const item of result) {
						// Intentionally left blank.
					}
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ServerError &&
						error.message === 'Server error occurred: Unexpected response status: 202 Accepted.',
				);
		});

		test("throws a server error if the server sends a stream item that can't be unmarshalled.", async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/read-subjects', (req, res) => {
					res.send('utter garbage\n');
				});
			}));

			let result = client.readSubjects(new AbortController());

			await assert
				.that(async () => {
					for await (const item of result) {
						// Intentionally left blank.
					}
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ServerError &&
						error.message === 'Server error occurred: Failed to read response.',
				);
		});

		test('throws a server error if the server sends a stream item with unsupported type.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/read-subjects', (req, res) => {
					res.send('{"type": ":clown:"}\n');
				});
			}));

			let result = client.readSubjects(new AbortController());

			await assert
				.that(async () => {
					for await (const item of result) {
						// Intentionally left blank.
					}
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ServerError &&
						error.message ===
							'Server error occurred: Failed to read subjects, an unexpected stream item was received: \'{"type":":clown:"}\'.',
				);
		});

		test('throws a server error if the server sends a an error item through the ndjson stream.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/read-subjects', (req, res) => {
					res.send('{"type": "error", "payload": { "error": "not enough JUICE 😩." }}\n');
				});
			}));

			let result = client.readSubjects(new AbortController());

			await assert
				.that(async () => {
					for await (const item of result) {
						// Intentionally left blank.
					}
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ServerError &&
						error.message === 'Server error occurred: not enough JUICE 😩.',
				);
		});

		test("throws a server error if the server sends a an error item through the ndjson stream, but the error can't be unmarshalled.", async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/read-subjects', (req, res) => {
					res.send('{"type": "error", "payload": 42}\n');
				});
			}));

			let result = client.readSubjects(new AbortController());

			await assert
				.that(async () => {
					for await (const item of result) {
						// Intentionally left blank.
					}
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ServerError &&
						error.message ===
							'Server error occurred: Failed to observe events, an unexpected stream item was received: \'{"type":"error","payload":42}\'.',
				);
		});
	});
});
