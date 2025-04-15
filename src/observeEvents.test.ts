import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import { EventSourcingDbContainer } from './EventSourcingDbContainer.js';

suite('observeEvents', { timeout: 30_000 }, () => {
	let container: EventSourcingDbContainer;

	beforeEach(async () => {
		container = new EventSourcingDbContainer();
		await container.start();
	});

	afterEach(async () => {
		await container.stop();
	});

	test('observes no events if the database is empty.', async (): Promise<void> => {
		const client = container.getClient();
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

		await client.writeEvents([firstEvent, secondEvent]);

		const controller = new AbortController();

		setTimeout(() => {
			controller.abort();
		}, 100);

		const eventsObserved: Event[] = [];
		for await (const event of client.observeEvents(
			'/test',
			{
				recursive: false,
			},
			controller.signal,
		)) {
			eventsObserved.push(event);
		}

		assert.equal(eventsObserved.length, 2);
	});

	test('observes recursively.', async (): Promise<void> => {
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

		await client.writeEvents([firstEvent, secondEvent]);

		const controller = new AbortController();

		setTimeout(() => {
			controller.abort();
		}, 100);

		const eventsObserved: Event[] = [];
		for await (const event of client.observeEvents(
			'/',
			{
				recursive: true,
			},
			controller.signal,
		)) {
			eventsObserved.push(event);
		}

		assert.equal(eventsObserved.length, 2);
	});

	test('observes with lower bound.', async (): Promise<void> => {
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

		await client.writeEvents([firstEvent, secondEvent]);

		const controller = new AbortController();

		setTimeout(() => {
			controller.abort();
		}, 100);

		const eventsObserved: Event[] = [];
		for await (const event of client.observeEvents(
			'/test',
			{
				recursive: false,
				lowerBound: { id: '1', type: 'inclusive' },
			},
			controller.signal,
		)) {
			eventsObserved.push(event);
		}

		assert.equal(eventsObserved.length, 1);
		assert.equal(eventsObserved[0].data.value, 42);
	});

	test('observes from latest event.', async (): Promise<void> => {
		const client = container.getClient();

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

		const eventsObserved: Event[] = [];
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
			eventsObserved.push(event);
		}

		assert.equal(eventsObserved.length, 1);
		assert.equal(eventsObserved[0].data.value, 42);
	});
});
