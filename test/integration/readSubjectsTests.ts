import { Database } from '../shared/Database';
import { testSource } from '../shared/events/source';
import { Source } from '../../lib/event/Source';
import { buildDatabase } from '../shared/buildDatabase';
import { startDatabase } from '../shared/startDatabase';
import { stopDatabase } from '../shared/stopDatabase';
import { assert } from 'assertthat';
import { EventCandidate } from '../../lib';
import { events } from '../shared/events/events';
import { CancelationError } from '../../lib/util/error/CancelationError';

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
				(error): boolean =>
					error.message ===
					"Malformed event subject, '' must be an absolute, slash-separated path.",
			);
	});
});
