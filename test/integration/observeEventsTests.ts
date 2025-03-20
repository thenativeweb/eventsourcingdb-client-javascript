import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import type { Client, StoreItem } from '../../lib/index.js';
import { CancelationError, Source } from '../../lib/index.js';
import { ClientError } from '../../lib/util/error/ClientError.js';
import { InvalidParameterError } from '../../lib/util/error/InvalidParameterError.js';
import { ServerError } from '../../lib/util/error/ServerError.js';
import type { Database } from '../shared/Database.js';
import { newAbortControllerWithDeadline } from '../shared/abortController/newAbortControllerWithDeadline.js';
import { buildDatabase } from '../shared/buildDatabase.js';
import { events } from '../shared/events/events.js';
import { testSource } from '../shared/events/source.js';
import { startDatabase } from '../shared/startDatabase.js';
import { startLocalHttpServer } from '../shared/startLocalHttpServer.js';
import { stopDatabase } from '../shared/stopDatabase.js';

suite('observeEvents', { timeout: 20_000 }, () => {
	let database: Database;
	const source = new Source(testSource);
	const testDeadline = 10_000;

	before(() => {
		buildDatabase('test/shared/docker/eventsourcingdb');
	});

	beforeEach(async () => {
		database = await startDatabase();

		await database.withAuthorization.client.writeEvents([
			source.newEvent(
				'/users/registered',
				events.registered.janeDoe.type,
				events.registered.janeDoe.data,
				events.registered.janeDoe.traceParent,
			),
			source.newEvent(
				'/users/loggedIn',
				events.loggedIn.janeDoe.type,
				events.loggedIn.janeDoe.data,
				events.loggedIn.janeDoe.traceParent,
			),
			source.newEvent(
				'/users/registered',
				events.registered.johnDoe.type,
				events.registered.johnDoe.data,
				events.registered.johnDoe.traceParent,
			),
			source.newEvent(
				'/users/loggedIn',
				events.loggedIn.johnDoe.type,
				events.loggedIn.johnDoe.data,
				events.loggedIn.johnDoe.traceParent,
			),
		]);
	});

	afterEach(() => {
		stopDatabase(database);
	});

	test('throws an error when trying to read from a non-reachable server.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert.rejects(
			async () => {
				const result = client.observeEvents(new AbortController(), '/', { recursive: false });

				for await (const _ of result) {
					// Do nothing.
				}
			},
			error => {
				assert.ok(error instanceof ServerError);
				assert.equal(error.message, 'Server error occurred: No response received.');
				return true;
			},
		);
	});

	test('throws an error if the subject is invalid.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert.rejects(
			async () => {
				const result = client.observeEvents(new AbortController(), 'applepie', {
					recursive: false,
				});

				for await (const _ of result) {
					// Do nothing.
				}
			},
			error => {
				assert.ok(error instanceof InvalidParameterError);
				assert.equal(
					error.message,
					"Parameter 'subject' is invalid: Failed to validate subject: 'applepie' must be an absolute, slash-separated path.",
				);
				return true;
			},
		);
	});

	test('supports authorization.', async (): Promise<void> => {
		const client = database.withAuthorization.client;
		const abortController = newAbortControllerWithDeadline(testDeadline);

		// Should not throw.
		let observedItemsCount = 0;
		const result = client.observeEvents(abortController, '/', { recursive: true });

		for await (const _data of result) {
			observedItemsCount += 1;

			if (observedItemsCount === 4) {
				return;
			}
		}
	});

	test('observes events from a single subject.', async (): Promise<void> => {
		const client = database.withAuthorization.client;
		const abortController = newAbortControllerWithDeadline(testDeadline);

		const observedItems: StoreItem[] = [];

		// Should not throw.
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
						events.registered.apfelFred.traceParent,
					),
				]);

				didPushIntermediateEvent = true;
			}

			if (observedItems.length === 3) {
				return;
			}
		}

		assert.equal(observedItems.length, 3);
		assert.equal(observedItems[0].event.source, testSource);
		assert.equal(observedItems[0].event.subject, '/users/registered');
		assert.equal(observedItems[0].event.type, events.registered.janeDoe.type);
		assert.equal(observedItems[0].event.data, events.registered.janeDoe.data);
		assert.equal(observedItems[0].event.traceParent, events.registered.janeDoe.traceParent);
		assert.equal(observedItems[1].event.source, testSource);
		assert.equal(observedItems[1].event.subject, '/users/registered');
		assert.equal(observedItems[1].event.type, events.registered.johnDoe.type);
		assert.equal(observedItems[1].event.data, events.registered.johnDoe.data);
		assert.equal(observedItems[1].event.traceParent, events.registered.johnDoe.traceParent);
		assert.equal(observedItems[2].event.source, testSource);
		assert.equal(observedItems[2].event.subject, '/users/registered');
		assert.equal(observedItems[2].event.type, events.registered.apfelFred.type);
		assert.equal(observedItems[2].event.data, events.registered.apfelFred.data);
		assert.equal(observedItems[2].event.traceParent, events.registered.apfelFred.traceParent);
	});

	test('observes events from a subject including child subjects.', async (): Promise<void> => {
		const client = database.withAuthorization.client;
		const abortController = newAbortControllerWithDeadline(testDeadline);

		const observedItems: StoreItem[] = [];

		// Should not throw.
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

		assert.equal(observedItems.length, 5);
		assert.equal(observedItems[0].event.source, testSource);
		assert.equal(observedItems[0].event.subject, '/users/registered');
		assert.equal(observedItems[0].event.type, events.registered.janeDoe.type);
		assert.equal(observedItems[0].event.data, events.registered.janeDoe.data);
		assert.equal(observedItems[1].event.source, testSource);
		assert.equal(observedItems[1].event.subject, '/users/loggedIn');
		assert.equal(observedItems[1].event.type, events.loggedIn.janeDoe.type);
		assert.equal(observedItems[1].event.data, events.loggedIn.janeDoe.data);
		assert.equal(observedItems[2].event.source, testSource);
		assert.equal(observedItems[2].event.subject, '/users/registered');
		assert.equal(observedItems[2].event.type, events.registered.johnDoe.type);
		assert.equal(observedItems[2].event.data, events.registered.johnDoe.data);
		assert.equal(observedItems[3].event.source, testSource);
		assert.equal(observedItems[3].event.subject, '/users/loggedIn');
		assert.equal(observedItems[3].event.type, events.loggedIn.johnDoe.type);
		assert.equal(observedItems[3].event.data, events.loggedIn.johnDoe.data);
		assert.equal(observedItems[4].event.source, testSource);
		assert.equal(observedItems[4].event.subject, '/users/registered');
		assert.equal(observedItems[4].event.type, events.registered.apfelFred.type);
		assert.equal(observedItems[4].event.data, events.registered.apfelFred.data);
	});

	test('observes events starting from the newest event matching the given event name.', async (): Promise<void> => {
		const client = database.withAuthorization.client;
		const abortController = newAbortControllerWithDeadline(testDeadline);

		const observedItems: StoreItem[] = [];
		// Should not throw.
		let didPushIntermediateEvent = false;
		const result = client.observeEvents(abortController, '/users', {
			recursive: true,
			fromLatestEvent: {
				subject: '/users/loggedIn',
				type: events.loggedIn.janeDoe.type,
				ifEventIsMissing: 'read-everything',
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

		assert.equal(observedItems.length, 2);
		assert.equal(observedItems[0].event.source, testSource);
		assert.equal(observedItems[0].event.subject, '/users/loggedIn');
		assert.equal(observedItems[0].event.type, events.loggedIn.johnDoe.type);
		assert.equal(observedItems[0].event.data, events.loggedIn.johnDoe.data);
		assert.equal(observedItems[1].event.source, testSource);
		assert.equal(observedItems[1].event.subject, '/users/loggedIn');
		assert.equal(observedItems[1].event.type, events.loggedIn.apfelFred.type);
		assert.equal(observedItems[1].event.data, events.loggedIn.apfelFred.data);
	});

	test('observes events starting from the lower bound ID.', async (): Promise<void> => {
		const client = database.withAuthorization.client;
		const abortController = newAbortControllerWithDeadline(testDeadline);

		const observedItems: StoreItem[] = [];
		// Should not throw.
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

		assert.equal(observedItems.length, 3);
		assert.equal(observedItems[0].event.source, testSource);
		assert.equal(observedItems[0].event.subject, '/users/registered');
		assert.equal(observedItems[0].event.type, events.registered.johnDoe.type);
		assert.equal(observedItems[0].event.data, events.registered.johnDoe.data);
		assert.equal(observedItems[1].event.source, testSource);
		assert.equal(observedItems[1].event.subject, '/users/loggedIn');
		assert.equal(observedItems[1].event.type, events.loggedIn.johnDoe.type);
		assert.equal(observedItems[1].event.data, events.loggedIn.johnDoe.data);
		assert.equal(observedItems[2].event.source, testSource);
		assert.equal(observedItems[2].event.subject, '/users/loggedIn');
		assert.equal(observedItems[2].event.type, events.loggedIn.apfelFred.type);
		assert.equal(observedItems[2].event.data, events.loggedIn.apfelFred.data);
	});

	test('throws an error when the AbortController is aborted.', async (): Promise<void> => {
		const abortController = new AbortController();
		const result = database.withAuthorization.client.observeEvents(abortController, '/', {
			recursive: true,
		});

		await assert.rejects(
			async () => {
				for await (const _item of result) {
					abortController.abort();
				}
			},
			error => {
				assert.ok(error instanceof CancelationError);
				return true;
			},
		);
	});

	test('throws an error if mutually exclusive options are used.', async (): Promise<void> => {
		const result = database.withAuthorization.client.observeEvents(
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

		await assert.rejects(
			async () => {
				for await (const _ of result) {
					// Intentionally left blank.
				}
			},
			error => {
				assert.ok(error instanceof InvalidParameterError);
				assert.equal(
					error.message,
					"Parameter 'options' is invalid: ObserveEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.",
				);
				return true;
			},
		);
	});

	test('throws an error if the given lowerBoundId does not contain an integer', async () => {
		const result = database.withAuthorization.client.observeEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				lowerBoundId: 'some-id',
			},
		);

		await assert.rejects(
			async () => {
				for await (const _item of result) {
					// Intentionally left blank.
				}
			},
			error => {
				assert.ok(error instanceof InvalidParameterError);
				assert.equal(
					error.message,
					"Parameter 'options' is invalid: ObserveEventsOptions are invalid: lowerBoundId must be 0 or greater.",
				);
				return true;
			},
		);
	});

	test('throws an error if the given lowerBoundId does not contain a negative integer', async () => {
		const result = database.withAuthorization.client.observeEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				lowerBoundId: '-3',
			},
		);

		await assert.rejects(
			async () => {
				for await (const _item of result) {
					// Intentionally left blank.
				}
			},
			error => {
				assert.ok(error instanceof InvalidParameterError);
				assert.equal(
					error.message,
					"Parameter 'options' is invalid: ObserveEventsOptions are invalid: lowerBoundId must be 0 or greater.",
				);
				return true;
			},
		);
	});

	test('throws an error if an incorrect subject is used in fromLatestEvent.', async () => {
		const result = database.withAuthorization.client.observeEvents(
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

		await assert.rejects(
			async () => {
				for await (const _item of result) {
					// Intentionally left blank.
				}
			},
			error => {
				assert.ok(error instanceof InvalidParameterError);
				assert.equal(
					error.message,
					"Parameter 'options' is invalid: ObserveEventsOptions are invalid: Failed to validate 'fromLatestEvent': Failed to validate subject: 'this is wrong' must be an absolute, slash-separated path.",
				);
				return true;
			},
		);
	});

	test('throws an error if an incorrect type is used in fromLatestEvent.', async () => {
		const result = database.withAuthorization.client.observeEvents(
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

		await assert.rejects(
			async () => {
				for await (const _item of result) {
					// Intentionally left blank.
				}
			},
			error => {
				assert.ok(error instanceof InvalidParameterError);
				assert.equal(
					error.message,
					"Parameter 'options' is invalid: ObserveEventsOptions are invalid: Failed to validate 'fromLatestEvent': Failed to validate type: 'this is wrong' must be a reverse domain name.",
				);
				return true;
			},
		);
	});

	suite('using a mock server', () => {
		let stopServer: () => Promise<void>;

		afterEach(async () => {
			await stopServer();
		});

		test('throws a server error if the server responds with http 5xx on every try.', async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
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
						'Server error occurred: Failed to observe events, an unexpected stream item was received: \'{"type":":clown:"}\'.',
					);
					return true;
				},
			);
		});

		test('throws a server error if the server sends a an error item through the ndjson stream.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
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

			await assert.rejects(
				async () => {
					for await (const _item of result) {
						// Intentionally left blank.
					}
				},
				error => {
					assert(error instanceof ServerError);
					assert(
						error.message,
						'Server error occurred: Failed to observe events, an unexpected stream item was received: \'{"type":"error","payload":42}\'.',
					);
					return true;
				},
			);
		});
	});
});
