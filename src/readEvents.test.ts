import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageTag } from './getImageTag.js';
import { containerStartTimeout } from './testing/containerStartTimeout.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

suite('readEvents', () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
		await container.start();
	}, containerStartTimeout);

	afterEach(async () => {
		await container.stop();
	}, integrationTimeout);

	test('reads no events if the database is empty.', integrationTimeout, async (): Promise<void> => {
		const client = container.getClient();

		let didReadEvents = false;
		for await (const _event of client.readEvents('/', {
			recursive: true,
		})) {
			didReadEvents = true;
		}

		assert.equal(didReadEvents, false);
	});

	test('reads all events from the given subject.', integrationTimeout, async (): Promise<void> => {
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

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/test', {
			recursive: false,
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 2);
	});

	test('reads recursively.', integrationTimeout, async (): Promise<void> => {
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

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/', {
			recursive: true,
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 2);
	});

	test('reads chronologically.', integrationTimeout, async (): Promise<void> => {
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

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/test', {
			recursive: false,
			order: 'chronological',
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 2);
		const [firstEventRead, secondEventRead] = eventsRead;
		assert.ok(firstEventRead);
		assert.ok(secondEventRead);
		assert.equal(firstEventRead.data.value, 23);
		assert.equal(secondEventRead.data.value, 42);
	});

	test('reads anti-chronologically.', integrationTimeout, async (): Promise<void> => {
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

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/test', {
			recursive: false,
			order: 'antichronological',
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 2);
		const [firstEventRead, secondEventRead] = eventsRead;
		assert.ok(firstEventRead);
		assert.ok(secondEventRead);
		assert.equal(firstEventRead.data.value, 42);
		assert.equal(secondEventRead.data.value, 23);
	});

	test('reads with lower bound.', integrationTimeout, async (): Promise<void> => {
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

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/test', {
			recursive: false,
			lowerBound: { id: '1', type: 'inclusive' },
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 1);
		const [eventRead] = eventsRead;
		assert.ok(eventRead);
		assert.equal(eventRead.data.value, 42);
	});

	test('reads with upper bound.', integrationTimeout, async (): Promise<void> => {
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

		const eventsRead: Event[] = [];
		for await (const event of client.readEvents('/test', {
			recursive: false,
			upperBound: { id: '0', type: 'inclusive' },
		})) {
			eventsRead.push(event);
		}

		assert.equal(eventsRead.length, 1);
		const [eventRead] = eventsRead;
		assert.ok(eventRead);
		assert.equal(eventRead.data.value, 23);
	});

	test('reads from latest event.', integrationTimeout, async (): Promise<void> => {
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
		const [eventRead] = eventsRead;
		assert.ok(eventRead);
		assert.equal(eventRead.data.value, 42);
	});
});
