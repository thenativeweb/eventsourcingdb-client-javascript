import { Client, StoreItem } from '../../lib';
import { CancelationError } from '../../lib';
import { Source } from '../../lib/event/Source';
import { ClientError } from '../../lib/util/error/ClientError';
import { InvalidParameterError } from '../../lib/util/error/InvalidParameterError';
import { ServerError } from '../../lib/util/error/ServerError';
import { Database } from '../shared/Database';
import { newAbortControllerWithDeadline } from '../shared/abortController/newAbortControllerWithDeadline';
import { buildDatabase } from '../shared/buildDatabase';
import { events } from '../shared/events/events';
import { testSource } from '../shared/events/source';
import { startDatabase } from '../shared/startDatabase';
import { startLocalHttpServer } from '../shared/startLocalHttpServer';
import { stopDatabase } from '../shared/stopDatabase';
import { assert } from 'assertthat';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

suite('Client.observeEvents()', function () {
	this.timeout(20_000);
	let database: Database;
	const source = new Source(testSource);
	const testDeadline = 10_000;

	suiteSetup(async () => {
		buildDatabase('test/shared/docker/eventsourcingdb');
	});

	setup(async () => {
		database = await startDatabase();

		await database.withoutAuthorization.client.writeEvents([
			source.newEvent(
				'/users/registered',
				events.registered.janeDoe.type,
				events.registered.janeDoe.data,
			),
			source.newEvent(
				'/users/loggedIn',
				events.loggedIn.janeDoe.type,
				events.loggedIn.janeDoe.data,
			),
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
		await database.withAuthorization.client.writeEvents([
			source.newEvent(
				'/users/registered',
				events.registered.janeDoe.type,
				events.registered.janeDoe.data,
			),
			source.newEvent(
				'/users/loggedIn',
				events.loggedIn.janeDoe.type,
				events.loggedIn.janeDoe.data,
			),
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
	});

	teardown(async () => {
		await stopDatabase(database);
	});

	test('throws an error when trying to read from a non-reachable server.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert
			.that(async () => {
				const result = client.observeEvents(new AbortController(), '/', { recursive: false });

				for await (const { event, hash } of result) {
					console.log(JSON.stringify({ event, hash }));
				}
			})
			.is.throwingAsync(
				(error) =>
					error instanceof ServerError &&
					error.message === 'Server error occurred: No response received.',
			);
	});

	test('throws an error if the subject is invalid.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert
			.that(async () => {
				const result = client.observeEvents(new AbortController(), 'applepie', {
					recursive: false,
				});

				for await (const { event, hash } of result) {
					console.log(JSON.stringify({ event, hash }));
				}
			})
			.is.throwingAsync(
				(error) =>
					error instanceof InvalidParameterError &&
					error.message ===
						"Parameter 'subject' is invalid: Failed to validate subject: 'applepie' must be an absolute, slash-separated path.",
			);
	});

	test('supports authorization.', async (): Promise<void> => {
		const client = database.withAuthorization.client;
		const abortController = newAbortControllerWithDeadline(testDeadline);

		await assert
			.that(async () => {
				let observedItemsCount = 0;
				const result = client.observeEvents(abortController, '/', { recursive: true });

				for await (const _data of result) {
					observedItemsCount += 1;

					if (observedItemsCount === 4) {
						return;
					}
				}
			})
			.is.not.throwingAsync();
	});

	test('observes events from a single subject.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;
		const abortController = newAbortControllerWithDeadline(testDeadline);

		const observedItems: StoreItem[] = [];
		await assert
			.that(async () => {
				let didPushIntermediateEvent = false;
				const result = client.observeEvents(abortController, '/users/registered', {
					recursive: false,
				});

				for await (const item of result) {
					observedItems.push(item);

					if (!didPushIntermediateEvent) {
						await client.writeEvents([
							source.newEvent(
								'/users/registered',
								events.registered.apfelFred.type,
								events.registered.apfelFred.data,
							),
						]);

						didPushIntermediateEvent = true;
					}

					if (observedItems.length === 3) {
						return;
					}
				}
			})
			.is.not.throwingAsync();

		assert.that(observedItems.length).is.equalTo(3);
		assert.that(observedItems[0].event.source).is.equalTo(testSource);
		assert.that(observedItems[0].event.subject).is.equalTo('/users/registered');
		assert.that(observedItems[0].event.type).is.equalTo(events.registered.janeDoe.type);
		assert.that(observedItems[0].event.data).is.equalTo(events.registered.janeDoe.data);
		assert.that(observedItems[1].event.source).is.equalTo(testSource);
		assert.that(observedItems[1].event.subject).is.equalTo('/users/registered');
		assert.that(observedItems[1].event.type).is.equalTo(events.registered.johnDoe.type);
		assert.that(observedItems[1].event.data).is.equalTo(events.registered.johnDoe.data);
		assert.that(observedItems[2].event.source).is.equalTo(testSource);
		assert.that(observedItems[2].event.subject).is.equalTo('/users/registered');
		assert.that(observedItems[2].event.type).is.equalTo(events.registered.apfelFred.type);
		assert.that(observedItems[2].event.data).is.equalTo(events.registered.apfelFred.data);
	});

	test('observes events from a subject including child subjects.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;
		const abortController = newAbortControllerWithDeadline(testDeadline);

		const observedItems: StoreItem[] = [];
		await assert
			.that(async () => {
				let didPushIntermediateEvent = false;
				const result = client.observeEvents(abortController, '/users', {
					recursive: true,
				});

				for await (const item of result) {
					observedItems.push(item);

					if (!didPushIntermediateEvent) {
						await client.writeEvents([
							source.newEvent(
								'/users/registered',
								events.registered.apfelFred.type,
								events.registered.apfelFred.data,
							),
						]);

						didPushIntermediateEvent = true;
					}

					if (observedItems.length === 5) {
						return;
					}
				}
			})
			.is.not.throwingAsync();

		assert.that(observedItems.length).is.equalTo(5);
		assert.that(observedItems[0].event.source).is.equalTo(testSource);
		assert.that(observedItems[0].event.subject).is.equalTo('/users/registered');
		assert.that(observedItems[0].event.type).is.equalTo(events.registered.janeDoe.type);
		assert.that(observedItems[0].event.data).is.equalTo(events.registered.janeDoe.data);
		assert.that(observedItems[1].event.source).is.equalTo(testSource);
		assert.that(observedItems[1].event.subject).is.equalTo('/users/loggedIn');
		assert.that(observedItems[1].event.type).is.equalTo(events.loggedIn.janeDoe.type);
		assert.that(observedItems[1].event.data).is.equalTo(events.loggedIn.janeDoe.data);
		assert.that(observedItems[2].event.source).is.equalTo(testSource);
		assert.that(observedItems[2].event.subject).is.equalTo('/users/registered');
		assert.that(observedItems[2].event.type).is.equalTo(events.registered.johnDoe.type);
		assert.that(observedItems[2].event.data).is.equalTo(events.registered.johnDoe.data);
		assert.that(observedItems[3].event.source).is.equalTo(testSource);
		assert.that(observedItems[3].event.subject).is.equalTo('/users/loggedIn');
		assert.that(observedItems[3].event.type).is.equalTo(events.loggedIn.johnDoe.type);
		assert.that(observedItems[3].event.data).is.equalTo(events.loggedIn.johnDoe.data);
		assert.that(observedItems[4].event.source).is.equalTo(testSource);
		assert.that(observedItems[4].event.subject).is.equalTo('/users/registered');
		assert.that(observedItems[4].event.type).is.equalTo(events.registered.apfelFred.type);
		assert.that(observedItems[4].event.data).is.equalTo(events.registered.apfelFred.data);
	});

	test('observes events starting from the newest event matching the given event name.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;
		const abortController = newAbortControllerWithDeadline(testDeadline);

		const observedItems: StoreItem[] = [];
		await assert
			.that(async () => {
				let didPushIntermediateEvent = false;
				const result = client.observeEvents(abortController, '/users', {
					recursive: true,
					fromLatestEvent: {
						subject: '/users/loggedIn',
						type: events.loggedIn.janeDoe.type,
						ifEventIsMissing: 'read-nothing',
					},
				});

				for await (const item of result) {
					observedItems.push(item);

					if (!didPushIntermediateEvent) {
						await client.writeEvents([
							source.newEvent(
								'/users/loggedIn',
								events.loggedIn.apfelFred.type,
								events.loggedIn.apfelFred.data,
							),
						]);

						didPushIntermediateEvent = true;
					}

					if (observedItems.length === 2) {
						return;
					}
				}
			})
			.is.not.throwingAsync();

		assert.that(observedItems.length).is.equalTo(2);
		assert.that(observedItems[0].event.source).is.equalTo(testSource);
		assert.that(observedItems[0].event.subject).is.equalTo('/users/loggedIn');
		assert.that(observedItems[0].event.type).is.equalTo(events.loggedIn.johnDoe.type);
		assert.that(observedItems[0].event.data).is.equalTo(events.loggedIn.johnDoe.data);
		assert.that(observedItems[1].event.source).is.equalTo(testSource);
		assert.that(observedItems[1].event.subject).is.equalTo('/users/loggedIn');
		assert.that(observedItems[1].event.type).is.equalTo(events.loggedIn.apfelFred.type);
		assert.that(observedItems[1].event.data).is.equalTo(events.loggedIn.apfelFred.data);
	});

	test('observes events starting from the lower bound ID.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;
		const abortController = newAbortControllerWithDeadline(testDeadline);

		const observedItems: StoreItem[] = [];
		await assert
			.that(async () => {
				let didPushIntermediateEvent = false;
				const result = client.observeEvents(abortController, '/users', {
					recursive: true,
					lowerBoundId: '2',
				});

				for await (const item of result) {
					observedItems.push(item);

					if (!didPushIntermediateEvent) {
						await client.writeEvents([
							source.newEvent(
								'/users/loggedIn',
								events.loggedIn.apfelFred.type,
								events.loggedIn.apfelFred.data,
							),
						]);

						didPushIntermediateEvent = true;
					}

					if (observedItems.length === 3) {
						return;
					}
				}
			})
			.is.not.throwingAsync();

		assert.that(observedItems.length).is.equalTo(3);
		assert.that(observedItems[0].event.source).is.equalTo(testSource);
		assert.that(observedItems[0].event.subject).is.equalTo('/users/registered');
		assert.that(observedItems[0].event.type).is.equalTo(events.registered.johnDoe.type);
		assert.that(observedItems[0].event.data).is.equalTo(events.registered.johnDoe.data);
		assert.that(observedItems[1].event.source).is.equalTo(testSource);
		assert.that(observedItems[1].event.subject).is.equalTo('/users/loggedIn');
		assert.that(observedItems[1].event.type).is.equalTo(events.loggedIn.johnDoe.type);
		assert.that(observedItems[1].event.data).is.equalTo(events.loggedIn.johnDoe.data);
		assert.that(observedItems[2].event.source).is.equalTo(testSource);
		assert.that(observedItems[2].event.subject).is.equalTo('/users/loggedIn');
		assert.that(observedItems[2].event.type).is.equalTo(events.loggedIn.apfelFred.type);
		assert.that(observedItems[2].event.data).is.equalTo(events.loggedIn.apfelFred.data);
	});

	test('throws an error when the AbortController is aborted.', async (): Promise<void> => {
		const abortController = new AbortController();
		const result = database.withoutAuthorization.client.observeEvents(abortController, '/', {
			recursive: true,
		});

		await assert
			.that(async () => {
				for await (const _item of result) {
					abortController.abort();
				}
			})
			.is.throwingAsync((error): boolean => error instanceof CancelationError);
	});

	test('throws an error if mutually exclusive options are used.', async (): Promise<void> => {
		const result = database.withoutAuthorization.client.observeEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				fromLatestEvent: {
					subject: '/',
					type: 'com.foobar.barbaz',
					ifEventIsMissing: 'wait-for-event',
				},
				lowerBoundId: '2',
			},
		);

		await assert
			.that(async () => {
				for await (const _item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				(error) =>
					error instanceof InvalidParameterError &&
					error.message ===
						"Parameter 'options' is invalid: ObserveEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.",
			);
	});

	test('throws an error if the given lowerBoundId does not contain an integer', async () => {
		const result = database.withoutAuthorization.client.observeEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				lowerBoundId: 'some-id',
			},
		);

		await assert
			.that(async () => {
				for await (const _item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				(error) =>
					error instanceof InvalidParameterError &&
					error.message ===
						"Parameter 'options' is invalid: ObserveEventsOptions are invalid: lowerBoundId must be 0 or greater.",
			);
	});

	test('throws an error if the given lowerBoundId does not contain a negative integer', async () => {
		const result = database.withoutAuthorization.client.observeEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				lowerBoundId: '-3',
			},
		);

		await assert
			.that(async () => {
				for await (const _item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				(error) =>
					error instanceof InvalidParameterError &&
					error.message ===
						"Parameter 'options' is invalid: ObserveEventsOptions are invalid: lowerBoundId must be 0 or greater.",
			);
	});

	test('throws an error if an incorrect subject is used in fromLatestEvent.', async () => {
		const result = database.withoutAuthorization.client.observeEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				fromLatestEvent: {
					type: 'com.some.type',
					subject: 'this is wrong',
					ifEventIsMissing: 'wait-for-event',
				},
			},
		);

		await assert
			.that(async () => {
				for await (const _item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				(error) =>
					error instanceof InvalidParameterError &&
					error.message ===
						"Parameter 'options' is invalid: ObserveEventsOptions are invalid: Failed to validate 'fromLatestEvent': Failed to validate subject: 'this is wrong' must be an absolute, slash-separated path.",
			);
	});

	test('throws an error if an incorrect type is used in fromLatestEvent.', async () => {
		const result = database.withoutAuthorization.client.observeEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				fromLatestEvent: {
					type: 'this is wrong',
					subject: '/some/subject',
					ifEventIsMissing: 'wait-for-event',
				},
			},
		);

		await assert
			.that(async () => {
				for await (const _item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				(error) =>
					error instanceof InvalidParameterError &&
					error.message ===
						"Parameter 'options' is invalid: ObserveEventsOptions are invalid: Failed to validate 'fromLatestEvent': Failed to validate type: 'this is wrong' must be a reverse domain name.",
			);
	});

	suite('using a mock server', () => {
		let stopServer: () => void;

		teardown(async () => {
			stopServer();
		});

		test('throws a server error if the server responds with http 5xx on every try.', async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/observe-events', (_req, res) => {
					res.status(StatusCodes.BAD_GATEWAY);
					res.send(ReasonPhrases.BAD_GATEWAY);
				});
			}));

			const result = client.observeEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'wait-for-event',
				},
			});

			await assert
				.that(async () => {
					for await (const _item of result) {
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
				app.post('/api/observe-events', (_req, res) => {
					res.setHeader('X-EventSourcingDB-Protocol-Version', '0.0.0');
					res.status(StatusCodes.UNPROCESSABLE_ENTITY);
					res.send(ReasonPhrases.UNPROCESSABLE_ENTITY);
				});
			}));

			const result = client.observeEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'wait-for-event',
				},
			});

			await assert
				.that(async () => {
					for await (const _item of result) {
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
				app.post('/api/observe-events', (_req, res) => {
					res.status(StatusCodes.IM_A_TEAPOT);
					res.send(ReasonPhrases.IM_A_TEAPOT);
				});
			}));

			const result = client.observeEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'wait-for-event',
				},
			});

			await assert
				.that(async () => {
					for await (const _item of result) {
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
				app.post('/api/observe-events', (_req, res) => {
					res.status(StatusCodes.ACCEPTED);
					res.send(ReasonPhrases.ACCEPTED);
				});
			}));

			const result = client.observeEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'wait-for-event',
				},
			});

			await assert
				.that(async () => {
					for await (const _item of result) {
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
				app.post('/api/observe-events', (_req, res) => {
					res.send('utter garbage\n');
				});
			}));

			const result = client.observeEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'wait-for-event',
				},
			});

			await assert
				.that(async () => {
					for await (const _item of result) {
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
				app.post('/api/observe-events', (_req, res) => {
					res.send('{"type": ":clown:"}\n');
				});
			}));

			const result = client.observeEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'wait-for-event',
				},
			});

			await assert
				.that(async () => {
					for await (const _item of result) {
						// Intentionally left blank.
					}
				})
				.is.throwingAsync(
					(error) =>
						error instanceof ServerError &&
						error.message ===
							'Server error occurred: Failed to observe events, an unexpected stream item was received: \'{"type":":clown:"}\'.',
				);
		});

		test('throws a server error if the server sends a an error item through the ndjson stream.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/observe-events', (_req, res) => {
					res.send('{"type": "error", "payload": { "error": "not enough JUICE 😩" }}\n');
				});
			}));

			const result = client.observeEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'wait-for-event',
				},
			});

			await assert
				.that(async () => {
					for await (const _item of result) {
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
				app.post('/api/observe-events', (_req, res) => {
					res.send('{"type": "error", "payload": 42}\n');
				});
			}));

			const result = client.observeEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'wait-for-event',
				},
			});

			await assert
				.that(async () => {
					for await (const _item of result) {
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
