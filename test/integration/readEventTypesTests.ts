import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import type { EventType } from '../../src/handlers/readEventTypes/EventType.js';
import { EventCandidate } from '../../src/index.js';
import type { Database } from '../shared/Database.js';
import { buildDatabase } from '../shared/buildDatabase.js';
import { testSource } from '../shared/events/source.js';
import { startDatabase } from '../shared/startDatabase.js';
import { stopDatabase } from '../shared/stopDatabase.js';

suite('readEventTypes', { timeout: 20_000 }, () => {
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

	test('Reads all event types of existing events, as well as all event types with registered schemas.', async () => {
		const client = database.withAuthorization.client;

		await client.writeEvents([
			new EventCandidate(testSource, '/account', 'com.foo.bar', {}),
			new EventCandidate(testSource, '/account/user', 'com.bar.baz', {}),
			new EventCandidate(testSource, '/account/user', 'com.baz.leml', {}),
			new EventCandidate(testSource, '/', 'com.quux.knax', {}),
		]);

		await client.registerEventSchema('org.ban.ban', { type: 'object' });
		await client.registerEventSchema('org.bing.chilling', { type: 'object' });

		const expectedEventTypes: EventType[] = [
			{
				eventType: 'com.bar.baz',
				isPhantom: false,
			},
			{
				eventType: 'com.baz.leml',
				isPhantom: false,
			},
			{
				eventType: 'com.foo.bar',
				isPhantom: false,
			},
			{
				eventType: 'com.quux.knax',
				isPhantom: false,
			},
			{
				eventType: 'org.ban.ban',
				isPhantom: true,
				schema: `{"type":"object"}`,
			},
			{
				eventType: 'org.bing.chilling',
				isPhantom: true,
				schema: `{"type":"object"}`,
			},
		];

		const observedEventTypes: EventType[] = [];
		for await (const observedEventType of client.readEventTypes(new AbortController())) {
			observedEventTypes.push(observedEventType);
		}

		assert.deepEqual(observedEventTypes, expectedEventTypes);
		assert.equal(observedEventTypes.length, expectedEventTypes.length);
	});
});
