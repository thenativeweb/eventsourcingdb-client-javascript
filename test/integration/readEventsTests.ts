import { Client, StoreItem } from '../../lib';
import { Source } from '../../lib';
import { CancelationError } from '../../lib';
import { ClientError } from '../../lib/util/error/ClientError';
import { InvalidParameterError } from '../../lib/util/error/InvalidParameterError';
import { ServerError } from '../../lib/util/error/ServerError';
import { Database } from '../shared/Database';
import { buildDatabase } from '../shared/buildDatabase';
import { events } from '../shared/events/events';
import { testSource } from '../shared/events/source';
import { startDatabase } from '../shared/startDatabase';
import { startLocalHttpServer } from '../shared/startLocalHttpServer';
import { stopDatabase } from '../shared/stopDatabase';
import { assert } from 'assertthat';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

suite('Client.readEvents()', function () {
	this.timeout(20_000);
	let database: Database;
	const source = new Source(testSource);

	suiteSetup(async () => {
		buildDatabase('test/shared/docker/eventsourcingdb');
	});

	setup(async () => {
		database = await startDatabase();

		await database.withAuthorization.client.writeEvents([
			source.newEvent(
				'/users/registered',
				events.registered.janeDoe.type,
				events.registered.janeDoe.data,
				events.registered.janeDoe.tracingContext,
			),
			source.newEvent(
				'/users/loggedIn',
				events.loggedIn.janeDoe.type,
				events.loggedIn.janeDoe.data,
				events.loggedIn.janeDoe.tracingContext,
			),
			source.newEvent(
				'/users/registered',
				events.registered.johnDoe.type,
				events.registered.johnDoe.data,
				events.registered.johnDoe.tracingContext,
			),
			source.newEvent(
				'/users/loggedIn',
				events.loggedIn.johnDoe.type,
				events.loggedIn.johnDoe.data,
				events.loggedIn.johnDoe.tracingContext,
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
				const result = client.readEvents(new AbortController(), '/', { recursive: false });

				for await (const _ of result) {
					// Do nothing.
				}
			})
			.is.throwingAsync();
	});

	test('supports authorization.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				const result = client.readEvents(new AbortController(), '/', { recursive: false });

				for await (const _ of result) {
					// Do nothing.
				}
			})
			.is.not.throwingAsync();
	});

	test('reads events from a single subject.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(
			new AbortController(),
			'/users/registered',
			{ recursive: false },
		);

		const readItems: StoreItem[] = [];
		for await (const item of result) {
			readItems.push(item);
		}

		assert.that(readItems.length).is.equalTo(2);
		assert.that(readItems[0].event.source).is.equalTo(testSource);
		assert.that(readItems[0].event.subject).is.equalTo('/users/registered');
		assert.that(readItems[0].event.type).is.equalTo(events.registered.janeDoe.type);
		assert.that(readItems[0].event.data).is.equalTo(events.registered.janeDoe.data);
		assert
			.that(readItems[0].event.tracingContext)
			.is.equalTo(events.registered.janeDoe.tracingContext);
		assert.that(readItems[1].event.source).is.equalTo(testSource);
		assert.that(readItems[1].event.subject).is.equalTo('/users/registered');
		assert.that(readItems[1].event.type).is.equalTo(events.registered.johnDoe.type);
		assert.that(readItems[1].event.data).is.equalTo(events.registered.johnDoe.data);
		assert
			.that(readItems[1].event.tracingContext)
			.is.equalTo(events.registered.johnDoe.tracingContext);
	});

	test('reads events from a subject including child subjects.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
		});

		const readItems: StoreItem[] = [];
		for await (const item of result) {
			readItems.push(item);
		}

		assert.that(readItems.length).is.equalTo(4);
		assert.that(readItems[0].event.source).is.equalTo(testSource);
		assert.that(readItems[0].event.subject).is.equalTo('/users/registered');
		assert.that(readItems[0].event.type).is.equalTo(events.registered.janeDoe.type);
		assert.that(readItems[0].event.data).is.equalTo(events.registered.janeDoe.data);
		assert.that(readItems[1].event.source).is.equalTo(testSource);
		assert.that(readItems[1].event.subject).is.equalTo('/users/loggedIn');
		assert.that(readItems[1].event.type).is.equalTo(events.loggedIn.janeDoe.type);
		assert.that(readItems[1].event.data).is.equalTo(events.loggedIn.janeDoe.data);
		assert.that(readItems[2].event.source).is.equalTo(testSource);
		assert.that(readItems[2].event.subject).is.equalTo('/users/registered');
		assert.that(readItems[2].event.type).is.equalTo(events.registered.johnDoe.type);
		assert.that(readItems[2].event.data).is.equalTo(events.registered.johnDoe.data);
		assert.that(readItems[3].event.source).is.equalTo(testSource);
		assert.that(readItems[3].event.subject).is.equalTo('/users/loggedIn');
		assert.that(readItems[3].event.type).is.equalTo(events.loggedIn.johnDoe.type);
		assert.that(readItems[3].event.data).is.equalTo(events.loggedIn.johnDoe.data);
	});

	test('reads the events in antichronological order.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(
			new AbortController(),
			'/users/registered',
			{ recursive: false, order: 'antichronological' },
		);

		const readItems: StoreItem[] = [];
		for await (const item of result) {
			readItems.push(item);
		}

		assert.that(readItems.length).is.equalTo(2);
		assert.that(readItems[0].event.source).is.equalTo(testSource);
		assert.that(readItems[0].event.subject).is.equalTo('/users/registered');
		assert.that(readItems[0].event.type).is.equalTo(events.registered.johnDoe.type);
		assert.that(readItems[0].event.data).is.equalTo(events.registered.johnDoe.data);
		assert.that(readItems[1].event.source).is.equalTo(testSource);
		assert.that(readItems[1].event.subject).is.equalTo('/users/registered');
		assert.that(readItems[1].event.type).is.equalTo(events.registered.janeDoe.type);
		assert.that(readItems[1].event.data).is.equalTo(events.registered.janeDoe.data);
	});

	test('reads events starting from the latest event matching the given event name.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			fromLatestEvent: {
				subject: '/users/loggedIn',
				type: events.loggedIn.janeDoe.type,
				ifEventIsMissing: 'read-everything',
			},
		});

		const readItems: StoreItem[] = [];
		for await (const item of result) {
			readItems.push(item);
		}

		assert.that(readItems.length).is.equalTo(1);
		assert.that(readItems[0].event.source).is.equalTo(testSource);
		assert.that(readItems[0].event.subject).is.equalTo('/users/loggedIn');
		assert.that(readItems[0].event.type).is.equalTo(events.loggedIn.johnDoe.type);
		assert.that(readItems[0].event.data).is.equalTo(events.loggedIn.johnDoe.data);
	});

	test('reads events starting from the lower bound ID.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			lowerBoundId: '2',
		});

		const readItems: StoreItem[] = [];
		for await (const item of result) {
			readItems.push(item);
		}

		assert.that(readItems.length).is.equalTo(2);
		assert.that(readItems[0].event.source).is.equalTo(testSource);
		assert.that(readItems[0].event.subject).is.equalTo('/users/registered');
		assert.that(readItems[0].event.type).is.equalTo(events.registered.johnDoe.type);
		assert.that(readItems[0].event.data).is.equalTo(events.registered.johnDoe.data);
		assert.that(readItems[1].event.source).is.equalTo(testSource);
		assert.that(readItems[1].event.subject).is.equalTo('/users/loggedIn');
		assert.that(readItems[1].event.type).is.equalTo(events.loggedIn.johnDoe.type);
		assert.that(readItems[1].event.data).is.equalTo(events.loggedIn.johnDoe.data);
	});

	test('reads events up to the upper bound ID.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			upperBoundId: '1',
		});

		const readItems: StoreItem[] = [];
		for await (const item of result) {
			readItems.push(item);
		}

		assert.that(readItems.length).is.equalTo(2);
		assert.that(readItems[0].event.source).is.equalTo(testSource);
		assert.that(readItems[0].event.subject).is.equalTo('/users/registered');
		assert.that(readItems[0].event.type).is.equalTo(events.registered.janeDoe.type);
		assert.that(readItems[0].event.data).is.equalTo(events.registered.janeDoe.data);
		assert.that(readItems[1].event.source).is.equalTo(testSource);
		assert.that(readItems[1].event.subject).is.equalTo('/users/loggedIn');
		assert.that(readItems[1].event.type).is.equalTo(events.loggedIn.janeDoe.type);
		assert.that(readItems[1].event.data).is.equalTo(events.loggedIn.janeDoe.data);
	});

	test('throws an error when the AbortController is aborted.', async (): Promise<void> => {
		const abortController = new AbortController();
		const result = database.withAuthorization.client.readEvents(abortController, '/users', {
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
		const result = database.withAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			fromLatestEvent: {
				subject: '/',
				type: 'com.foobar.barbaz',
				ifEventIsMissing: 'read-everything',
			},
			lowerBoundId: '2',
		});

		await assert
			.that(async () => {
				for await (const _item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				"Parameter 'options' is invalid: ReadEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.",
			);
	});

	test('throws an error if the subject is invalid.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(new AbortController(), 'invalid', {
			recursive: true,
		});

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
						"Parameter 'subject' is invalid: Failed to validate subject: 'invalid' must be an absolute, slash-separated path.",
			);
	});

	test('throws an error if the given lowerBoundID does not contain an integer.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			lowerBoundId: 'invalid',
		});

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
						"Parameter 'options' is invalid: ReadEventsOptions are invalid: lowerBoundId must be 0 or greater.",
			);
	});

	test('throws an error if the given lowerBoundID contains an integer that is negative.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			lowerBoundId: '-1',
		});

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
						"Parameter 'options' is invalid: ReadEventsOptions are invalid: lowerBoundId must be 0 or greater.",
			);
	});

	test('throws an error if the given upperBoundID does not contain an integer.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			upperBoundId: 'invalid',
		});

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
						"Parameter 'options' is invalid: ReadEventsOptions are invalid: upperBoundId must be 0 or greater.",
			);
	});

	test('throws an error if the given upperBoundID contains an integer that is negative.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			upperBoundId: '-1',
		});

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
						"Parameter 'options' is invalid: ReadEventsOptions are invalid: upperBoundId must be 0 or greater.",
			);
	});

	test('throws an error if an incorrect subject is used in ReadFromLatestEvent.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			fromLatestEvent: {
				subject: 'invalid',
				type: 'com.foo.bar',
				ifEventIsMissing: 'read-everything',
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
					error instanceof InvalidParameterError &&
					error.message ===
						"Parameter 'options' is invalid: ReadEventsOptions are invalid: Failed to validate 'fromLatestEvent': Failed to validate subject: 'invalid' must be an absolute, slash-separated path.",
			);
	});

	test('throws an error if an incorrect type is used in ReadFromLatestEvent.', async (): Promise<void> => {
		const result = database.withAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			fromLatestEvent: {
				subject: '/users',
				type: 'invalid',
				ifEventIsMissing: 'read-everything',
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
					error instanceof InvalidParameterError &&
					error.message ===
						"Parameter 'options' is invalid: ReadEventsOptions are invalid: Failed to validate 'fromLatestEvent': Failed to validate type: 'invalid' must be a reverse domain name.",
			);
	});

	suite('using a mock server', () => {
		let stopServer: () => void;

		teardown(async () => {
			stopServer();
		});

		test('throws a sever error if the server responds with HTTP 5xx on every try.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/read-events', (_req, res) => {
					res.status(StatusCodes.BAD_GATEWAY);
					res.send(ReasonPhrases.BAD_GATEWAY);
				});
			}));

			const result = client.readEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'read-nothing',
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
				app.post('/api/read-events', (_req, res) => {
					res.setHeader('X-EventSourcingDB-Protocol-Version', '0.0.0');
					res.status(StatusCodes.UNPROCESSABLE_ENTITY);
					res.send(ReasonPhrases.UNPROCESSABLE_ENTITY);
				});
			}));

			const result = client.readEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'read-nothing',
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
				app.post('/api/read-events', (_req, res) => {
					res.status(StatusCodes.IM_A_TEAPOT);
					res.send(ReasonPhrases.IM_A_TEAPOT);
				});
			}));

			const result = client.readEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'read-nothing',
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

		test('throws a server error if the server returns a non 200, 5xx or 4xx status code.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/read-events', (_req, res) => {
					res.status(StatusCodes.ACCEPTED);
					res.send(ReasonPhrases.ACCEPTED);
				});
			}));

			const result = client.readEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'read-nothing',
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
				app.post('/api/read-events', (_req, res) => {
					res.send('utter garbage\n');
				});
			}));

			const result = client.readEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'read-nothing',
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
				app.post('/api/read-events', (_req, res) => {
					res.send('{"type": ":clown:"}\n');
				});
			}));

			const result = client.readEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'read-nothing',
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
							'Server error occurred: Failed to read events, an unexpected stream item was received: \'{"type":":clown:"}\'.',
				);
		});

		test('throws a server error if the server sends a an error item through the ndjson stream.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/read-events', (_req, res) => {
					res.send('{"type": "error", "payload": { "error": "not enough JUICE 😩" }}\n');
				});
			}));

			const result = client.readEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'read-nothing',
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
				app.post('/api/read-events', (_req, res) => {
					res.send('{"type": "error", "payload": 42}\n');
				});
			}));

			const result = client.readEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'read-nothing',
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
							'Server error occurred: Failed to read events, an unexpected stream item was received: \'{"type":"error","payload":42}\'.',
				);
		});
	});
});
