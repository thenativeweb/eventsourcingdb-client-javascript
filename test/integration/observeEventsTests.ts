import { assert } from 'assertthat';
import { Client, StoreItem } from '../../lib';
import { Source } from '../../lib/event/Source';
import { newAbortControllerWithDeadline } from '../shared/abortController/newAbortControllerWithDeadline';
import { buildDatabase } from '../shared/buildDatabase';
import { Database } from '../shared/Database';
import { events } from '../shared/events/events';
import { testSource } from '../shared/events/source';
import { startDatabase } from '../shared/startDatabase';
import { stopDatabase } from '../shared/stopDatabase';
import { CancelationError } from '../../lib/util/error/CancelationError';
import { startLocalHttpServer } from '../shared/startLocalHttpServer';
import express from 'express';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';
import { ServerError } from '../../lib/util/error/ServerError';

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
			.is.throwingAsync();
	});

	test('supports authorization.', async (): Promise<void> => {
		const client = database.withAuthorization.client;
		const abortController = newAbortControllerWithDeadline(testDeadline);

		await assert
			.that(async () => {
				let observedItemsCount = 0;
				const result = client.observeEvents(abortController, '/', { recursive: true });

				for await (const data of result) {
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
				for await (const item of result) {
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
				for await (const item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				"Parameter 'options' is invalid: ObserveEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.",
			);
	});

	test('throws an error if the given lowerBoundId does not contain an integer', async () => {
		let result = database.withoutAuthorization.client.observeEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				lowerBoundId: 'some-id',
			},
		);

		await assert
			.that(async () => {
				for await (const item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				"Parameter 'options' is invalid: ObserveEventOptions are invalid: lowerBoundId needs to be a positive integer.",
			);
	});

	test('throws an error if the given lowerBoundId does not contain a negative integer', async () => {
		let result = database.withoutAuthorization.client.observeEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				lowerBoundId: '-3',
			},
		);

		await assert
			.that(async () => {
				for await (const item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				"Parameter 'options' is invalid: ObserveEventOptions are invalid: lowerBoundId needs to be a positive integer.",
			);
	});

	test('throws an error if an incorrect subject is used in fromLatestEvent.', async () => {
		let result = database.withoutAuthorization.client.observeEvents(
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
				for await (const item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				"Parameter 'options' is invalid: Failed to validate subject: 'this is wrong' must be an absolute, slash-separated path.",
			);
	});

	test('throws an error if an incorrect type is used in fromLatestEvent.', async () => {
		let result = database.withoutAuthorization.client.observeEvents(
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
				for await (const item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				"Parameter 'options' is invalid: Failed to validate type: 'this is wrong' must be a reverse domain name.",
			);
	});

	suite('using a mock server', () => {
		let stopServer: () => void;

		teardown(async () => {
			stopServer();
		});

		test('throws a server error if the server responses with http 5xx on every try.', async () => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer((app) => {
				app.post('/api/observe-events', (req, res) => {
					res.status(StatusCodes.BAD_GATEWAY);
					res.send(ReasonPhrases.BAD_GATEWAY);
				});
			}));

			let result = client.observeEvents(new AbortController(), '/users', {
				recursive: true,
				fromLatestEvent: {
					type: 'com.subject.some',
					subject: '/some/subject',
					ifEventIsMissing: 'wait-for-event',
				},
			});

			await assert
				.that(async () => {
					for await (const item of result) {
						// Intentionally left blank.
					}
				})
				.is.throwingAsync((error) => error instanceof ServerError);
		});
	});
});
