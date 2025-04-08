import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { Client } from '../src/Client.js';
import type { EventCandidate } from '../src/EventCandidate.js';
import type { EventType } from '../src/EventType.js';
import { EventSourcingDb } from './docker/EventSourcingDb.js';

suite('readEventTypes', { timeout: 20_000 }, () => {
	let eventSourcingDb: EventSourcingDb;

	before(() => {
		EventSourcingDb.build();
	});

	beforeEach(async () => {
		eventSourcingDb = await EventSourcingDb.run();
	});

	afterEach(() => {
		eventSourcingDb.kill();
	});

	test('reads no event types if the database is empty.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		let didReadEventTypes = false;
		for await (const _event of client.readEventTypes()) {
			didReadEventTypes = true;
		}

		assert.equal(didReadEventTypes, false);
	});

	test('reads all event types.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		const firstEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/1',
			type: 'io.eventsourcingdb.test.foo',
			data: {
				value: 23,
			},
		};

		const secondEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/2',
			type: 'io.eventsourcingdb.test.bar',
			data: {
				value: 42,
			},
		};

		await client.writeEvents([firstEvent, secondEvent]);

		const eventTypesRead: EventType[] = [];
		for await (const eventType of client.readEventTypes()) {
			eventTypesRead.push(eventType);
		}

		assert.deepEqual(eventTypesRead, [
			{
				eventType: 'io.eventsourcingdb.test.bar',
				isPhantom: false,
			},
			{
				eventType: 'io.eventsourcingdb.test.foo',
				isPhantom: false,
			},
		]);
	});

	test('supports reading event schemas.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		const eventType = 'io.eventsourcingdb.test';
		const schema = {
			type: 'object',
			properties: {
				value: {
					type: 'number',
				},
			},
			required: ['value'],
			additionalProperties: false,
		};

		await client.registerEventSchema(eventType, schema);

		const eventTypesRead: EventType[] = [];
		for await (const eventType of client.readEventTypes()) {
			eventTypesRead.push(eventType);
		}

		assert.deepEqual(eventTypesRead, [
			{
				eventType: 'io.eventsourcingdb.test',
				isPhantom: true,
				schema,
			},
		]);
	});

	test('supports aborting reading.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		const firstEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/1',
			type: 'io.eventsourcingdb.test.foo',
			data: {
				value: 23,
			},
		};

		const secondEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/2',
			type: 'io.eventsourcingdb.test.bar',
			data: {
				value: 42,
			},
		};

		await client.writeEvents([firstEvent, secondEvent]);

		const eventTypesRead: EventType[] = [];
		for await (const eventType of client.readEventTypes()) {
			eventTypesRead.push(eventType);
			break;
		}

		assert.deepEqual(eventTypesRead, [
			{
				eventType: 'io.eventsourcingdb.test.bar',
				isPhantom: false,
			},
		]);
	});
});
