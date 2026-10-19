import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageTag } from './getImageTag.js';
import { containerStartTimeout } from './testing/containerStartTimeout.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

// The events of a test are written before it observes them, so they arrive
// at once. A test stops observing once the expected number of events has
// arrived, and fails if they have not arrived within this many milliseconds.
const observeTimeout = 10_000;

const observeUntil = async (
	observe: (signal: AbortSignal) => AsyncGenerator<Event, void, void>,
	expectedCount: number,
): Promise<Event[]> => {
	const events: Event[] = [];
	const controller = new AbortController();
	const timer = setTimeout(() => {
		controller.abort();
	}, observeTimeout);

	try {
		for await (const event of observe(controller.signal)) {
			events.push(event);

			if (events.length === expectedCount) {
				break;
			}
		}
	} finally {
		clearTimeout(timer);
	}

	if (events.length < expectedCount) {
		throw new Error(
			`Observed ${events.length} of ${expectedCount} events within ${observeTimeout} milliseconds.`,
		);
	}

	return events;
};

suite('observeEvents', () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
		await container.start();
	}, containerStartTimeout);

	afterEach(async () => {
		await container.stop();
	}, integrationTimeout);

	test(
		'observes no events if the database is empty.',
		integrationTimeout,
		async (): Promise<void> => {
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
		},
	);

	test(
		'observes all events from the given subject.',
		integrationTimeout,
		async (): Promise<void> => {
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

			const eventsObserved = await observeUntil(
				signal =>
					client.observeEvents(
						'/test',
						{
							recursive: false,
						},
						signal,
					),
				2,
			);

			assert.equal(eventsObserved.length, 2);
		},
	);

	test('observes recursively.', integrationTimeout, async (): Promise<void> => {
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

		const eventsObserved = await observeUntil(
			signal =>
				client.observeEvents(
					'/',
					{
						recursive: true,
					},
					signal,
				),
			2,
		);

		assert.equal(eventsObserved.length, 2);
	});

	test('observes with lower bound.', integrationTimeout, async (): Promise<void> => {
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

		const eventsObserved = await observeUntil(
			signal =>
				client.observeEvents(
					'/test',
					{
						recursive: false,
						lowerBound: { id: '1', type: 'inclusive' },
					},
					signal,
				),
			1,
		);

		assert.equal(eventsObserved.length, 1);
		const [eventObserved] = eventsObserved;
		assert.ok(eventObserved);
		assert.equal(eventObserved.data.value, 42);
	});

	test('observes from latest event.', integrationTimeout, async (): Promise<void> => {
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

		const eventsObserved = await observeUntil(
			signal =>
				client.observeEvents(
					'/test',
					{
						recursive: false,
						fromLatestEvent: {
							subject: '/test',
							type: 'io.eventsourcingdb.test.bar',
							ifEventIsMissing: 'read-everything',
						},
					},
					signal,
				),
			1,
		);

		assert.equal(eventsObserved.length, 1);
		const [eventObserved] = eventsObserved;
		assert.ok(eventObserved);
		assert.equal(eventObserved.data.value, 42);
	});
});
