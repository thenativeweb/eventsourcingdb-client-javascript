import { EventCandidate } from '../../lib';
import { Database } from '../shared/Database';
import { buildDatabase } from '../shared/buildDatabase';
import { testSource } from '../shared/events/source';
import { startDatabase } from '../shared/startDatabase';
import { stopDatabase } from '../shared/stopDatabase';
import { assert } from 'assertthat';

suite('Client.registerEventSchema()', function () {
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

	test("Registers the new schema if it doesn't conflict with existing events.", async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await client.writeEvents([new EventCandidate(testSource, '/eppes', 'com.ekht.ekht', {})]);

		await client.registerEventSchema('com.ekht.ekht', { type: 'object' });
	});

	test('Rejects the request if at least one of the existing events conflicts with the schema.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await client.writeEvents([
			new EventCandidate(testSource, '/eppes', 'com.gornisht.ekht', { oy: 'gevalt' }),
		]);

		await assert
			.that(async () => {
				await client.registerEventSchema('com.gornisht.ekht', {
					type: 'object',
					additionalProperties: false,
				});
			})
			.is.throwingAsync();
	});

	test('Rejects the request if the schema already exists.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await client.writeEvents([new EventCandidate(testSource, '/eppes', 'com.ekht.ekht', {})]);

		await client.registerEventSchema('com.ekht.ekht', { type: 'object' });

		await assert
			.that(async () => {
				await client.registerEventSchema('com.ekht.ekht', { type: 'object' });
			})
			.is.throwingAsync();
	});

	test('Rejects the request if the given schema is not valid JSON.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				await client.registerEventSchema('com.ekht.ekht', '{"type":');
			})
			.is.throwingAsync();
	});

	test('Rejects the request if the given schema is not valid JSONSchema.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				await client.registerEventSchema('com.ekht.ekht', { type: 'object', properties: 'banana' });
			})
			.is.throwingAsync();
	});

	test('Rejects the request if the given schema does not specify an object at the top level.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				await client.registerEventSchema('com.ekht.ekht', { type: 'array' });
			})
			.is.throwingAsync();
	});
});
