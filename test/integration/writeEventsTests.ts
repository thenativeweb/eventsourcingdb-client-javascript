import { assert } from 'assertthat';
import { buildDatabase } from '../shared/buildDatabase';
import { Database } from '../shared/Database';
import { events } from '../shared/events/events';
import { testSource } from '../shared/events/source';
import { startDatabase } from '../shared/startDatabase';
import { stopDatabase } from '../shared/stopDatabase';

suite('Client.writeEvents', function () {
	this.timeout(20_000);
	let database: Database;

	suiteSetup(async () => {
		buildDatabase('test/shared/docker/eventsourcingdb');
	});

	setup(async () => {
		database = await startDatabase();
	});

	teardown(async () => {
		await stopDatabase(database);
	});

	test('returns an error when trying to write to a non-reachable server.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert
			.that(async () => {
				await client.writeEvents([
					testSource.newEvent(
						'/foobar',
						events.registered.janeDoe.type,
						events.registered.janeDoe.data,
					),
				]);
			})
			.is.throwingAsync();
	});
});
