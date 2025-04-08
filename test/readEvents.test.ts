import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { Client } from '../src/Client.js';
import type { Event } from '../src/Event.js';
import type { EventCandidate } from '../src/EventCandidate.js';
import { EventSourcingDb } from './docker/EventSourcingDb.js';

suite('readEvents', { timeout: 5_000 }, () => {
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

	test('reads no events if the database is empty.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		let didReadEvents = false;
		for await (const _event of client.readEvents('/', {
			recursive: true,
		})) {
			didReadEvents = true;
		}

		assert.equal(didReadEvents, false);
	});

	test('reads all events from the given subject.', async (): Promise<void> => {
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

		await client.writeEvents([firstEvent, secondEvent]);

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/test', {
			recursive: false,
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 2);
	});

	test('reads recursively.', async (): Promise<void> => {
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

		await client.writeEvents([firstEvent, secondEvent]);

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/', {
			recursive: true,
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 2);
	});

	test('reads chronologically.', async (): Promise<void> => {
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

		await client.writeEvents([firstEvent, secondEvent]);

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/test', {
			recursive: false,
			order: 'chronological',
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 2);
		assert.equal(eventsRead[0].data.value, 23);
		assert.equal(eventsRead[1].data.value, 42);
	});

	test('reads anti-chronologically.', async (): Promise<void> => {
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

		await client.writeEvents([firstEvent, secondEvent]);

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/test', {
			recursive: false,
			order: 'antichronological',
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 2);
		assert.equal(eventsRead[0].data.value, 42);
		assert.equal(eventsRead[1].data.value, 23);
	});

	test('reads with lower bound.', async (): Promise<void> => {
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

		await client.writeEvents([firstEvent, secondEvent]);

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/test', {
			recursive: false,
			lowerBound: { id: '1', type: 'inclusive' },
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 1);
		assert.equal(eventsRead[0].data.value, 42);
	});

	test('reads with upper bound.', async (): Promise<void> => {
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

		await client.writeEvents([firstEvent, secondEvent]);

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/test', {
			recursive: false,
			upperBound: { id: '0', type: 'inclusive' },
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 1);
		assert.equal(eventsRead[0].data.value, 23);
	});

	test('reads from latest event.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		const firstEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test.foo',
			data: {
				value: 23,
			},
		};

		const secondEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test.bar',
			data: {
				value: 42,
			},
		};

		await client.writeEvents([firstEvent, secondEvent]);

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/test', {
			recursive: false,
			fromLatestEvent: {
				subject: '/test',
				type: 'io.eventsourcingdb.test.bar',
				ifEventIsMissing: 'read-everything',
			},
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 1);
		assert.equal(eventsRead[0].data.value, 42);
	});
});
