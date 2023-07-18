import {
	Client,
	isSubjectOnEventId,
	isSubjectPristine,
	Source,
	StoreItem,
	TracingContext,
} from '../../lib';
import { ClientError } from '../../lib/util/error/ClientError';
import { InvalidParameterError } from '../../lib/util/error/InvalidParameterError';
import { ServerError } from '../../lib/util/error/ServerError';
import { Database } from '../shared/Database';
import { buildDatabase } from '../shared/buildDatabase';
import { events } from '../shared/events/events';
import { testSource } from '../shared/events/source';
import { prefixEventType } from '../shared/events/type';
import { startDatabase } from '../shared/startDatabase';
import { startLocalHttpServer } from '../shared/startLocalHttpServer';
import { stopDatabase } from '../shared/stopDatabase';
import { assert } from 'assertthat';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { TraceFlags } from '@opentelemetry/api';

suite('Client.writeEvents()', function () {
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

	test('throws an error when trying to write to a non-reachable server.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert
			.that(async () => {
				await client.writeEvents([
					source.newEvent(
						'/foobar',
						events.registered.janeDoe.type,
						events.registered.janeDoe.data,
					),
				]);
			})
			.is.throwingAsync(
				(error) =>
					error instanceof ServerError &&
					error.message === 'Server error occurred: No response received.',
			);
	});

	test('throws an error if no candidates are passed.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				await client.writeEvents([]);
			})
			.is.throwingAsync(
				(error) =>
					error instanceof InvalidParameterError &&
					error.message ===
						"Parameter 'eventCandidates' is invalid: eventCandidates must contain at least one EventCandidate.",
			);
	});

	test('throws an error if a candidate subject is malformed.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				await client.writeEvents([
					source.newEvent('foobar', events.registered.janeDoe.type, events.registered.janeDoe.data),
				]);
			})
			.is.throwingAsync(
				(error) =>
					error instanceof InvalidParameterError &&
					error.message ===
						"Parameter 'eventCandidates' is invalid: Failed to validate subject: 'foobar' must be an absolute, slash-separated path.",
			);
	});

	test('throws an error if a candidate type is malformed.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				await client.writeEvents([
					source.newEvent('/foobar', 'haram', events.registered.janeDoe.data),
				]);
			})
			.is.throwingAsync(
				(error) =>
					error instanceof InvalidParameterError &&
					error.message ===
						"Parameter 'eventCandidates' is invalid: Failed to validate type: 'haram' must be a reverse domain name.",
			);
	});

	test.skip('throws an error if a precondition uses an invalid source.', async (): Promise<void> => {
		assert.that(true).is.false();
	});

	test('supports authorization.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				await client.writeEvents([
					source.newEvent(
						'/foobar',
						events.registered.janeDoe.type,
						events.registered.janeDoe.data,
					),
				]);
			})
			.is.not.throwingAsync();
	});

	test('writes a single event.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				await client.writeEvents([
					source.newEvent(
						'/foobar',
						events.registered.janeDoe.type,
						events.registered.janeDoe.data,
						new TracingContext(
							'eb0e08452e7ee4b0d3b8b30987c37951',
							'c31bc0a7013beab8',
							TraceFlags.NONE,
						),
					),
				]);
			})
			.is.not.throwingAsync();
	});

	test('returns the written event metadata.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				await client.writeEvents([
					source.newEvent(
						'/users/registered',
						events.registered.janeDoe.type,
						events.registered.janeDoe.data,
					),
				]);
			})
			.is.not.throwingAsync();

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

		assert.that(writtenEventsMetadata.length).is.equalTo(2);
		assert.that(writtenEventsMetadata[0].source).is.equalTo(testSource);
		assert.that(writtenEventsMetadata[0].type).is.equalTo(prefixEventType('registered'));
		assert.that(writtenEventsMetadata[0].subject).is.equalTo('/users/registered');
		assert.that(writtenEventsMetadata[0].id).is.equalTo('1');
		assert.that(writtenEventsMetadata[1].source).is.equalTo(testSource);
		assert.that(writtenEventsMetadata[1].type).is.equalTo(prefixEventType('loggedIn'));
		assert.that(writtenEventsMetadata[1].subject).is.equalTo('/users/loggedIn');
		assert.that(writtenEventsMetadata[1].id).is.equalTo('2');
	});

	test('writes multiple events.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
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
			})
			.is.not.throwingAsync();
	});

	suite('when using the isSubjectPristine precondition', (): void => {
		test('writes the events if the subject is pristine.', async (): Promise<void> => {
			const client = database.withAuthorization.client;

			await assert
				.that(async () => {
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
				})
				.is.not.throwingAsync();
		});

		test('throws an error if the subject is not pristine.', async (): Promise<void> => {
			const client = database.withAuthorization.client;

			await assert
				.that(async () => {
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
				})
				.is.not.throwingAsync();

			await assert
				.that(async () => {
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
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ClientError &&
						error.message === "Client error occurred: Request failed with status code '409'.",
				);
		});
	});

	suite('when using the isSubjectOnEventId precondition', (): void => {
		test('writes the events if the last event of the subject has the given event ID.', async (): Promise<void> => {
			const client = database.withAuthorization.client;

			await assert
				.that(async () => {
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
				})
				.is.not.throwingAsync();

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

			await assert
				.that(async () => {
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
				})
				.is.not.throwingAsync();
		});

		test('throws an error if the last event of the subject does not have the given event ID.', async (): Promise<void> => {
			const client = database.withAuthorization.client;

			await assert
				.that(async () => {
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
				})
				.is.not.throwingAsync();

			const lastEventId = '1337';

			await assert
				.that(async () => {
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
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ClientError &&
						error.message === "Client error occurred: Request failed with status code '409'.",
				);
		});
	});

	suite('using mocked HTTP server', (): void => {
		let stopServer: () => void;

		teardown(async () => {
			stopServer();
		});

		const events = [source.newEvent('/', 'com.foobar.baz', {})];

		test('throws a server error if the server responds with http 5xx on every try.', async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/write-events', (_req, res) => {
					res.status(StatusCodes.BAD_GATEWAY);
					res.send(ReasonPhrases.BAD_GATEWAY);
				});
			}));

			await assert
				.that(async () => {
					await client.writeEvents(events);
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

		test("throws an error if the server's protocol version does not match.", async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/write-events', (_req, res) => {
					res.setHeader('X-EventSourcingDB-Protocol-Version', '0.0.0');
					res.status(StatusCodes.UNPROCESSABLE_ENTITY);
					res.send(ReasonPhrases.UNPROCESSABLE_ENTITY);
				});
			}));

			await assert
				.that(async () => {
					await client.writeEvents(events);
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ClientError &&
						error.message ===
							"Client error occurred: Protocol version mismatch, server '0.0.0', client '1.0.0.'",
				);
		});

		test('throws a client error if the server returns a 4xx status code.', async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/write-events', (_req, res) => {
					res.status(StatusCodes.IM_A_TEAPOT);
					res.send(ReasonPhrases.IM_A_TEAPOT);
				});
			}));

			await assert
				.that(async () => {
					await client.writeEvents(events);
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ClientError &&
						error.message === "Client error occurred: Request failed with status code '418'.",
				);
		});

		test('returns a server error if the server returns a non 200, 5xx or 4xx status code.', async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/write-events', (_req, res) => {
					res.status(StatusCodes.ACCEPTED);
					res.send(ReasonPhrases.ACCEPTED);
				});
			}));

			await assert
				.that(async () => {
					await client.writeEvents(events);
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ServerError &&
						error.message === 'Server error occurred: Unexpected response status: 202 Accepted.',
				);
		});

		test("throws a server error if the server's response can't be parsed.", async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/write-events', (_req, res) => {
					res.send('utter garbage');
				});
			}));

			await assert
				.that(async () => {
					await client.writeEvents(events);
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ServerError &&
						error.message ===
							"Server error occurred: Failed to parse response 'utter garbage' to array.",
				);
		});
	});
});
