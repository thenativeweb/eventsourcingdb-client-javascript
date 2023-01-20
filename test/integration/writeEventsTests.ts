import { assert } from 'assertthat';
import { Source } from '../../lib/event/Source';
import { isSubjectOnEventId, isSubjectPristine } from '../../lib/handlers/writeEvents/Precondition';
import { buildDatabase } from '../shared/buildDatabase';
import { Database } from '../shared/Database';
import { events } from '../shared/events/events';
import { testSource } from '../shared/events/source';
import { prefixEventType } from '../shared/events/type';
import { startDatabase } from '../shared/startDatabase';
import { stopDatabase } from '../shared/stopDatabase';

suite('Client.writeEvents', function () {
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
			.is.throwingAsync();
	});

	test('throws an error if a candidate subject is malformed.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;

		await assert
			.that(async () => {
				await client.writeEvents([
					source.newEvent('foobar', events.registered.janeDoe.type, events.registered.janeDoe.data),
				]);
			})
			.is.throwingAsync(/Malformed event subject/gu);
	});

	test('throws an error if a candidate type is malformed.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;

		await assert
			.that(async () => {
				await client.writeEvents([
					source.newEvent('/foobar', 'haram', events.registered.janeDoe.data),
				]);
			})
			.is.throwingAsync(/Malformed event type/gu);
	});

	test('throws an error if a precondition uses an invalid source.', async (): Promise<void> => {
		//TODO: implement URI validation?
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
		const client = database.withoutAuthorization.client;

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

	test('returns the written event metadata.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;

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
		const client = database.withoutAuthorization.client;

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

	test('throws an error when trying to write an empty list of events.', async (): Promise<void> => {
		const client = database.withoutAuthorization.client;

		await assert
			.that(async () => {
				await client.writeEvents([]);
			})
			.is.throwingAsync();
	});

	suite('when using the isSubjectPristine precondition', (): void => {
		test('writes the events if the subject is pristine.', async (): Promise<void> => {
			const client = database.withoutAuthorization.client;

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
			const client = database.withoutAuthorization.client;

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
				.is.throwingAsync();
		});
	});

	suite('when using the isSubjectOnEventId precondition', (): void => {
		test('writes the events if the last event of the subject has the given event ID.', async (): Promise<void> => {
			const client = database.withoutAuthorization.client;

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

			//TODO: get lastEventId from client.readEvents()
			const lastEventId = '1';

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
			const client = database.withoutAuthorization.client;

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
				.is.throwingAsync();
		});
	});
});
