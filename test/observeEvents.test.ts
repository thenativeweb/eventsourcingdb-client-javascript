import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { Client } from '../src/Client.js';
import type { Event } from '../src/Event.js';
import type { EventCandidate } from '../src/EventCandidate.js';
import { EventSourcingDb } from './docker/EventSourcingDb.js';

suite('observeEvents', { timeout: 5_000 }, () => {
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

	test('observes no events if the database is empty.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		const controller = new AbortController();

		setTimeout(() => {
			controller.abort();
		}, 100);

		let didObserveEvents = false;
		for await (const _event of client.observeEvents(
			'/',
			{
				recursive: true,
			},
			controller.signal,
		)) {
			didObserveEvents = true;
		}

		assert.equal(didObserveEvents, false);
	});

	test('observes all events from the given subject.', async (): Promise<void> => {
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

		const controller = new AbortController();

		setTimeout(() => {
			controller.abort();
		}, 100);

		const eventsRead: Event[] = [];
		for await (const event of client.observeEvents(
			'/test',
			{
				recursive: false,
			},
			controller.signal,
		)) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 2);
	});

	test('observes recursively.', async (): Promise<void> => {
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

		const controller = new AbortController();

		setTimeout(() => {
			controller.abort();
		}, 100);

		const eventsRead: Event[] = [];
		for await (const event of client.observeEvents(
			'/',
			{
				recursive: true,
			},
			controller.signal,
		)) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 2);
	});

	test('observes with lower bound.', async (): Promise<void> => {
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

		const controller = new AbortController();

		setTimeout(() => {
			controller.abort();
		}, 100);

		const eventsRead: Event[] = [];
		for await (const event of client.observeEvents(
			'/test',
			{
				recursive: false,
				lowerBound: { id: '1', type: 'inclusive' },
			},
			controller.signal,
		)) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 1);
		assert.equal(eventsRead[0].data.value, 42);
	});

	test('observes from latest event.', async (): Promise<void> => {
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

		const controller = new AbortController();

		setTimeout(() => {
			controller.abort();
		}, 100);

		const eventsRead: Event[] = [];
		for await (const event of client.observeEvents(
			'/test',
			{
				recursive: false,
				fromLatestEvent: {
					subject: '/test',
					type: 'io.eventsourcingdb.test.bar',
					ifEventIsMissing: 'read-everything',
				},
			},
			controller.signal,
		)) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 1);
		assert.equal(eventsRead[0].data.value, 42);
	});
});
