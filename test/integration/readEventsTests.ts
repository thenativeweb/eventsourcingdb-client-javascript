import { assert } from 'assertthat';
import { StoreItem } from '../../lib';
import { Source } from '../../lib/event/Source';
import { buildDatabase } from '../shared/buildDatabase';
import { Database } from '../shared/Database';
import { events } from '../shared/events/events';
import { testSource } from '../shared/events/source';
import { startDatabase } from '../shared/startDatabase';
import { stopDatabase } from '../shared/stopDatabase';
import { CancelationError } from '../../lib/util/error/CancelationError';

suite('Client.readEvents()', function () {
	this.timeout(20_000);
	let database: Database;
	const source = new Source(testSource);

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
	});

	teardown(async () => {
		await stopDatabase(database);
	});

	test('throws an error when trying to read from a non-reachable server.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert
			.that(async () => {
				const result = client.readEvents(new AbortController(), '/', { recursive: false });

				for await (const { event, hash } of result) {
					console.log(JSON.stringify({ event, hash }));
				}
			})
			.is.throwingAsync();
	});

	test('supports authorization.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				const result = client.readEvents(new AbortController(), '/', { recursive: false });

				for await (const { event, hash } of result) {
					console.log(JSON.stringify({ event, hash }));
				}
			})
			.is.not.throwingAsync();
	});

	test('reads events from a single subject.', async (): Promise<void> => {
		const result = database.withoutAuthorization.client.readEvents(
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
		assert.that(readItems[1].event.source).is.equalTo(testSource);
		assert.that(readItems[1].event.subject).is.equalTo('/users/registered');
		assert.that(readItems[1].event.type).is.equalTo(events.registered.johnDoe.type);
		assert.that(readItems[1].event.data).is.equalTo(events.registered.johnDoe.data);
	});

	test('reads events from a subject including child subjects.', async (): Promise<void> => {
		const result = database.withoutAuthorization.client.readEvents(
			new AbortController(),
			'/users',
			{ recursive: true },
		);

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

	test('reads the events in reversed chronological order.', async (): Promise<void> => {
		const result = database.withoutAuthorization.client.readEvents(
			new AbortController(),
			'/users/registered',
			{ recursive: false, chronological: false },
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
		const result = database.withoutAuthorization.client.readEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				fromLatestEvent: {
					subject: '/users/loggedIn',
					type: events.loggedIn.janeDoe.type,
					ifEventIsMissing: 'read-everything',
				},
			},
		);

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
		const result = database.withoutAuthorization.client.readEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				lowerBoundId: '2',
			},
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
		assert.that(readItems[1].event.subject).is.equalTo('/users/loggedIn');
		assert.that(readItems[1].event.type).is.equalTo(events.loggedIn.johnDoe.type);
		assert.that(readItems[1].event.data).is.equalTo(events.loggedIn.johnDoe.data);
	});

	test('reads events up to the upper bound ID.', async (): Promise<void> => {
		const result = database.withoutAuthorization.client.readEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				upperBoundId: '1',
			},
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
		assert.that(readItems[1].event.source).is.equalTo(testSource);
		assert.that(readItems[1].event.subject).is.equalTo('/users/loggedIn');
		assert.that(readItems[1].event.type).is.equalTo(events.loggedIn.janeDoe.type);
		assert.that(readItems[1].event.data).is.equalTo(events.loggedIn.janeDoe.data);
	});

	test('throws an error when the AbortController is aborted.', async (): Promise<void> => {
		const abortController = new AbortController();
		const result = database.withoutAuthorization.client.readEvents(abortController, '/users', {
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
		const result = database.withoutAuthorization.client.readEvents(
			new AbortController(),
			'/users',
			{
				recursive: true,
				fromLatestEvent: {
					subject: '/',
					type: 'com.foobar.barbaz',
					ifEventIsMissing: 'read-everything',
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
				'ReadEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.',
			);
	});

	test('throws an error if incorrect options are used.', async (): Promise<void> => {
		let result = database.withoutAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			fromLatestEvent: {
				subject: '',
				type: 'com.foobar.barbaz',
				ifEventIsMissing: 'read-everything',
			},
		});

		await assert
			.that(async () => {
				for await (const item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync(
				"Failed to validate subject: '' must be an absolute, slash-separated path.",
			);

		result = database.withoutAuthorization.client.readEvents(new AbortController(), '/users', {
			recursive: true,
			fromLatestEvent: {
				subject: '/',
				type: 'com.',
				ifEventIsMissing: 'read-everything',
			},
		});

		await assert
			.that(async () => {
				for await (const item of result) {
					// Intentionally left blank.
				}
			})
			.is.throwingAsync("Failed to validate type: 'com.' must be reverse domain name.");
	});
});
