import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { Client } from '../src/Client.js';
import type { EventCandidate } from '../src/EventCandidate.js';
import { isSubjectOnEventId } from '../src/isSubjectOnEventId.js';
import { isSubjectPristine } from '../src/isSubjectPristine.js';
import { EventSourcingDb } from './docker/EventSourcingDb.js';

suite('writeEvents', { timeout: 20_000 }, () => {
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

	test('writes a single event.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		const event: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 42,
			},
		};

		const writtenEvents = await client.writeEvents([event]);

		assert.strictEqual(writtenEvents.length, 1);
		assert.strictEqual(writtenEvents[0].id, '0');
	});

	test('writes multiple events.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		const firstEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 23,
			},
		};

		const secondEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 42,
			},
		};

		const writtenEvents = await client.writeEvents([firstEvent, secondEvent]);
		assert.strictEqual(writtenEvents.length, 2);

		assert.strictEqual(writtenEvents[0].id, '0');
		assert.strictEqual(writtenEvents[0].data.value, 23);

		assert.strictEqual(writtenEvents[1].id, '1');
		assert.strictEqual(writtenEvents[1].data.value, 42);
	});

	test('supports the isSubjectPristine precondition.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		const firstEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 23,
			},
		};

		await client.writeEvents([firstEvent]);

		const secondEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 42,
			},
		};

		await assert.rejects(
			async () => {
				await client.writeEvents([secondEvent], [isSubjectPristine('/test')]);
			},
			error => {
				assert.ok(error instanceof Error);
				assert.equal(
					error.message,
					"Failed to write events, got HTTP status code '409', expected '200'.",
				);
				return true;
			},
		);
	});

	test('supports the isSubjectOnEventId precondition.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		const firstEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 23,
			},
		};

		await client.writeEvents([firstEvent]);

		const secondEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 42,
			},
		};

		await assert.rejects(
			async () => {
				await client.writeEvents([secondEvent], [isSubjectOnEventId('/test', '1')]);
			},
			error => {
				assert.ok(error instanceof Error);
				assert.equal(
					error.message,
					"Failed to write events, got HTTP status code '409', expected '200'.",
				);
				return true;
			},
		);
	});
});
