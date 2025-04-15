import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import type { EventCandidate } from './EventCandidate.js';
import { EventSourcingDbContainer } from './EventSourcingDbContainer.js';
import { isSubjectOnEventId } from './isSubjectOnEventId.js';
import { isSubjectPristine } from './isSubjectPristine.js';

suite('writeEvents', { timeout: 30_000 }, () => {
	let container: EventSourcingDbContainer;

	beforeEach(async () => {
		container = new EventSourcingDbContainer();
		await container.start();
	});

	afterEach(async () => {
		await container.stop();
	});

	test('writes a single event.', async (): Promise<void> => {
		const client = container.getClient();

		const event: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 42,
			},
		};

		const writtenEvents = await client.writeEvents([event]);

		assert.equal(writtenEvents.length, 1);
		assert.equal(writtenEvents[0].id, '0');
	});

	test('writes multiple events.', async (): Promise<void> => {
		const client = container.getClient();

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
		assert.equal(writtenEvents.length, 2);

		assert.equal(writtenEvents[0].id, '0');
		assert.equal(writtenEvents[0].data.value, 23);

		assert.equal(writtenEvents[1].id, '1');
		assert.equal(writtenEvents[1].data.value, 42);
	});

	test('supports the isSubjectPristine precondition.', async (): Promise<void> => {
		const client = container.getClient();

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
		const client = container.getClient();

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
