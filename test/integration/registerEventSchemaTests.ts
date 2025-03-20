import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { EventCandidate } from '../../lib/index.js';
import type { Database } from '../shared/Database.js';
import { buildDatabase } from '../shared/buildDatabase.js';
import { testSource } from '../shared/events/source.js';
import { startDatabase } from '../shared/startDatabase.js';
import { stopDatabase } from '../shared/stopDatabase.js';

suite('registerEventSchema', { timeout: 20_000 }, () => {
	let database: Database;

	before(() => {
		buildDatabase('test/shared/docker/eventsourcingdb');
	});

	beforeEach(async () => {
		database = await startDatabase();
	});

	afterEach(() => {
		stopDatabase(database);
	});

	test("registers the new schema if it doesn't conflict with existing events.", async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await client.writeEvents([new EventCandidate(testSource, '/eppes', 'com.ekht.ekht', {})]);

		await client.registerEventSchema('com.ekht.ekht', { type: 'object' });
	});

	test('rejects the request if at least one of the existing events conflicts with the schema.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await client.writeEvents([
			new EventCandidate(testSource, '/eppes', 'com.gornisht.ekht', { oy: 'gevalt' }),
		]);

		await assert.rejects(async () => {
			await client.registerEventSchema('com.gornisht.ekht', {
				type: 'object',
				additionalProperties: false,
			});
		});
	});

	test('rejects the request if the schema already exists.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await client.writeEvents([new EventCandidate(testSource, '/eppes', 'com.ekht.ekht', {})]);

		await client.registerEventSchema('com.ekht.ekht', { type: 'object' });

		await assert.rejects(async () => {
			await client.registerEventSchema('com.ekht.ekht', { type: 'object' });
		});
	});

	test('rejects the request if the given schema is not valid JSON.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert.rejects(async () => {
			await client.registerEventSchema('com.ekht.ekht', '{"type":');
		});
	});

	test('rejects the request if the given schema is not valid JSONSchema.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert.rejects(async () => {
			await client.registerEventSchema('com.ekht.ekht', { type: 'object', properties: 'banana' });
		});
	});

	test('rejects the request if the given schema does not specify an object at the top level.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert.rejects(async () => {
			await client.registerEventSchema('com.ekht.ekht', { type: 'array' });
		});
	});
});
