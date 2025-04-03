import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { Source, isSubjectOnEventId, isSubjectPristine } from '../../src/index.js';
import type { Client, StoreItem } from '../../src/index.js';
import { ClientError } from '../../src/util/error/ClientError.js';
import { InvalidParameterError } from '../../src/util/error/InvalidParameterError.js';
import { ServerError } from '../../src/util/error/ServerError.js';
import type { Database } from '../shared/Database.js';
import { buildDatabase } from '../shared/buildDatabase.js';
import { events } from '../shared/events/events.js';
import { testSource } from '../shared/events/source.js';
import { prefixEventType } from '../shared/events/type.js';
import { startDatabase } from '../shared/startDatabase.js';
import { startLocalHttpServer } from '../shared/startLocalHttpServer.js';
import { stopDatabase } from '../shared/stopDatabase.js';

suite('writeEvents', { timeout: 20_000 }, () => {
	let database: Database;
	const source = new Source(testSource);

	before(() => {
		buildDatabase('test/shared/docker/eventsourcingdb');
	});

	beforeEach(async () => {
		database = await startDatabase();
	});

	afterEach(() => {
		stopDatabase(database);
	});

	test('throws an error when trying to write to a non-reachable server.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert.rejects(
			async () => {
				await client.writeEvents([
					source.newEvent(
						'/foobar',
						events.registered.janeDoe.type,
						events.registered.janeDoe.data,
					),
				]);
			},
			error => {
				assert.ok(error instanceof ServerError);
				assert.equal(error.message, 'Server error occurred: No response received.');
				return true;
			},
		);
	});

	test('throws an error if no candidates are passed.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert.rejects(
			async () => {
				await client.writeEvents([]);
			},
			error => {
				assert.ok(error instanceof InvalidParameterError);
				assert.equal(
					error.message,
					"Parameter 'eventCandidates' is invalid: eventCandidates must contain at least one EventCandidate.",
				);
				return true;
			},
		);
	});

	test('throws an error if a candidate subject is malformed.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert.rejects(
			async () => {
				await client.writeEvents([
					source.newEvent('foobar', events.registered.janeDoe.type, events.registered.janeDoe.data),
				]);
			},
			error => {
				assert.ok(error instanceof InvalidParameterError);
				assert.equal(
					error.message,
					"Parameter 'eventCandidates' is invalid: Failed to validate subject: 'foobar' must be an absolute, slash-separated path.",
				);
				return true;
			},
		);
	});

	test('throws an error if a candidate type is malformed.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert.rejects(
			async () => {
				await client.writeEvents([
					source.newEvent('/foobar', 'haram', events.registered.janeDoe.data),
				]);
			},
			error => {
				assert.ok(error instanceof InvalidParameterError);
				assert.equal(
					error.message,
					"Parameter 'eventCandidates' is invalid: Failed to validate type: 'haram' must be a reverse domain name.",
				);
				return true;
			},
		);
	});

	test('throws an error if a precondition uses an invalid source.');

	test('supports authorization.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		// Should not throw.
		await client.writeEvents([
			source.newEvent('/foobar', events.registered.janeDoe.type, events.registered.janeDoe.data),
		]);
	});

	test('writes a single event.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		// Should not throw.
		await client.writeEvents([
			source.newEvent(
				'/foobar',
				events.registered.janeDoe.type,
				events.registered.janeDoe.data,
				'00-eb0e08452e7ee4b0d3b8b30987c37951-c31bc0a7013beab8-00',
			),
		]);
	});

	test('returns the written event metadata.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		// Should not throw.
		await client.writeEvents([
			source.newEvent(
				'/users/registered',
				events.registered.janeDoe.type,
				events.registered.janeDoe.data,
			),
		]);

		const writtenEventsMetadata = await client.writeEvents([
			source.newEvent(
				'/users/registered',
				events.registered.johnDoe.type,
				events.registered.johnDoe.data,
			),
			source.newEvent(
				'/users/loggedIn',
				events.loggedIn.johnDoe.type,
				events.loggedIn.johnDoe.data,
			),
		]);

		assert.equal(writtenEventsMetadata.length, 2);
		assert.equal(writtenEventsMetadata[0].source, testSource);
		assert.equal(writtenEventsMetadata[0].type, prefixEventType('registered'));
		assert.equal(writtenEventsMetadata[0].subject, '/users/registered');
		assert.equal(writtenEventsMetadata[0].id, '1');
		assert.equal(writtenEventsMetadata[1].source, testSource);
		assert.equal(writtenEventsMetadata[1].type, prefixEventType('loggedIn'));
		assert.equal(writtenEventsMetadata[1].subject, '/users/loggedIn');
		assert.equal(writtenEventsMetadata[1].id, '2');
	});

	test('writes multiple events.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		// Should not throw.
		await client.writeEvents([
			source.newEvent(
				'/users/registered',
				events.registered.janeDoe.type,
				events.registered.janeDoe.data,
			),
			source.newEvent(
				'/users/registered',
				events.registered.johnDoe.type,
				events.registered.johnDoe.data,
			),
		]);
	});

	test('throws an error if any of the given events does not validate against the schema.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await client.registerEventSchema('com.knackige.wuerstchen', {
			type: 'object',
			additionalProperties: false,
		});

		await assert.rejects(
			async () => {
				await client.writeEvents([
					source.newEvent('/users/registered', 'com.knackige.wuerstchen', { oh: 'no' }),
				]);
			},
			{
				message: "Client error occurred: Request failed with status code '409'.",
			},
		);
	});

	suite('when using the isSubjectPristine precondition', (): void => {
		test('writes the events if the subject is pristine.', async (): Promise<void> => {
			const client = database.withAuthorization.client;

			// Should not throw.
			await client.writeEvents(
				[
					source.newEvent(
						'/users/registered',
						events.registered.janeDoe.type,
						events.registered.janeDoe.data,
					),
				],
				[isSubjectPristine({ subject: '/users/registered' })],
			);
		});

		test('throws an error if the subject is not pristine.', async (): Promise<void> => {
			const client = database.withAuthorization.client;

			// Should not throw.
			await client.writeEvents(
				[
					source.newEvent(
						'/users/registered',
						events.registered.janeDoe.type,
						events.registered.janeDoe.data,
					),
				],
				[isSubjectPristine({ subject: '/users/registered' })],
			);

			await assert.rejects(
				async () => {
					await client.writeEvents(
						[
							source.newEvent(
								'/users/registered',
								events.registered.johnDoe.type,
								events.registered.johnDoe.data,
							),
						],
						[isSubjectPristine({ subject: '/users/registered' })],
					);
				},
				error => {
					assert.ok(error instanceof ClientError);
					assert.equal(
						error.message,
						"Client error occurred: Request failed with status code '409'.",
					);
					return true;
				},
			);
		});
	});

	suite('when using the isSubjectOnEventId precondition', (): void => {
		test('writes the events if the last event of the subject has the given event ID.', async (): Promise<void> => {
			const client = database.withAuthorization.client;

			// Should not throw.
			await client.writeEvents([
				source.newEvent(
					'/users/registered',
					events.registered.janeDoe.type,
					events.registered.janeDoe.data,
				),
				source.newEvent(
					'/users/registered',
					events.registered.johnDoe.type,
					events.registered.johnDoe.data,
				),
			]);

			const readEventsResult = database.withAuthorization.client.readEvents(
				new AbortController(),
				'/users/registered',
				{ recursive: false },
			);

			const readItems: StoreItem[] = [];
			for await (const item of readEventsResult) {
				readItems.push(item);
			}
			const lastEventId = readItems[readItems.length - 1].event.id;

			// Should not throw.
			await client.writeEvents(
				[
					source.newEvent(
						'/users/registered',
						events.registered.apfelFred.type,
						events.registered.apfelFred.data,
					),
				],
				[isSubjectOnEventId({ subject: '/users/registered', eventId: lastEventId })],
			);
		});

		test('throws an error if the last event of the subject does not have the given event ID.', async (): Promise<void> => {
			const client = database.withAuthorization.client;

			// Should not throw.
			await client.writeEvents([
				source.newEvent(
					'/users/registered',
					events.registered.janeDoe.type,
					events.registered.janeDoe.data,
				),
				source.newEvent(
					'/users/registered',
					events.registered.johnDoe.type,
					events.registered.johnDoe.data,
				),
			]);

			const lastEventId = '1337';

			await assert.rejects(
				async () => {
					await client.writeEvents(
						[
							source.newEvent(
								'/users/registered',
								events.registered.apfelFred.type,
								events.registered.apfelFred.data,
							),
						],
						[isSubjectOnEventId({ subject: '/users/registered', eventId: lastEventId })],
					);
				},
				error => {
					assert.ok(error instanceof ClientError);
					assert.equal(
						error.message,
						"Client error occurred: Request failed with status code '409'.",
					);
					return true;
				},
			);
		});
	});

	suite('using mocked HTTP server', (): void => {
		let stopServer: () => Promise<void>;

		afterEach(async () => {
			await stopServer();
		});

		const events = [source.newEvent('/', 'com.foobar.baz', {})];

		test('throws a server error if the server responds with http 5xx on every try.', async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/write-events', (_req, res) => {
					res.status(StatusCodes.BAD_GATEWAY);
					res.send(ReasonPhrases.BAD_GATEWAY);
				});
			}));

			await assert.rejects(
				async () => {
					await client.writeEvents(events);
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

		test("throws an error if the server's protocol version does not match.", async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/write-events', (_req, res) => {
					res.setHeader('X-EventSourcingDB-Protocol-Version', '0.0.0');
					res.status(StatusCodes.UNPROCESSABLE_ENTITY);
					res.send(ReasonPhrases.UNPROCESSABLE_ENTITY);
				});
			}));

			await assert.rejects(
				async () => {
					await client.writeEvents(events);
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

		test('throws a client error if the server returns a 4xx status code.', async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/write-events', (_req, res) => {
					res.status(StatusCodes.IM_A_TEAPOT);
					res.send(ReasonPhrases.IM_A_TEAPOT);
				});
			}));

			await assert.rejects(
				async () => {
					await client.writeEvents(events);
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

		test('returns a server error if the server returns a non 200, 5xx or 4xx status code.', async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/write-events', (_req, res) => {
					res.status(StatusCodes.ACCEPTED);
					res.send(ReasonPhrases.ACCEPTED);
				});
			}));

			await assert.rejects(
				async () => {
					await client.writeEvents(events);
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

		test("throws a server error if the server's response can't be parsed.", async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.post('/api/write-events', (_req, res) => {
					res.send('utter garbage');
				});
			}));

			await assert.rejects(
				async () => {
					await client.writeEvents(events);
				},
				error => {
					assert.ok(error instanceof ServerError);
					assert.equal(
						error.message,
						"Server error occurred: Failed to parse response 'utter garbage' to array.",
					);
					return true;
				},
			);
		});
	});
});
