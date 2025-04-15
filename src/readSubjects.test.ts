import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import type { EventCandidate } from './EventCandidate.js';
import { EventSourcingDbContainer } from './EventSourcingDbContainer.js';

suite('readSubjects', { timeout: 30_000 }, () => {
	let container: EventSourcingDbContainer;

	beforeEach(async () => {
		container = new EventSourcingDbContainer();
		await container.start();
	});

	afterEach(async () => {
		await container.stop();
	});

	test('reads no subjects if the database is empty.', async (): Promise<void> => {
		const client = container.getClient();

		let didReadSubjects = false;
		for await (const _event of client.readSubjects('/')) {
			didReadSubjects = true;
		}

		assert.equal(didReadSubjects, false);
	});

	test('reads all subjects.', async (): Promise<void> => {
		const client = container.getClient();

		const firstEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/1',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 23,
			},
		};

		const secondEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/2',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 42,
			},
		};

		await client.writeEvents([firstEvent, secondEvent]);

		const subjectsRead: string[] = [];
		for await (const subject of client.readSubjects('/')) {
			subjectsRead.push(subject);
		}

		assert.equal(subjectsRead.length, 4);
		assert.equal(subjectsRead[0], '/');
		assert.equal(subjectsRead[1], '/test');
		assert.equal(subjectsRead[2], '/test/1');
		assert.equal(subjectsRead[3], '/test/2');
	});

	test('reads all subjects from the base subject.', async (): Promise<void> => {
		const client = container.getClient();

		const firstEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/1',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 23,
			},
		};

		const secondEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/2',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 42,
			},
		};

		await client.writeEvents([firstEvent, secondEvent]);

		const subjectsRead: string[] = [];
		for await (const subject of client.readSubjects('/test')) {
			subjectsRead.push(subject);
		}

		assert.equal(subjectsRead.length, 3);
		assert.equal(subjectsRead[0], '/test');
		assert.equal(subjectsRead[1], '/test/1');
		assert.equal(subjectsRead[2], '/test/2');
	});
});
