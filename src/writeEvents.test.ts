import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import { DbApiError } from './DbApiError.js';
import { ErrorCode } from './ErrorCode.js';
import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageTag } from './getImageTag.js';
import { isEventQlQueryTrue } from './isEventQlQueryTrue.js';
import { isSubjectOnEventId } from './isSubjectOnEventId.js';
import { isSubjectPopulated } from './isSubjectPopulated.js';
import { isSubjectPristine } from './isSubjectPristine.js';
import { containerStartTimeout } from './testing/containerStartTimeout.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

// Both APIs report a precondition that does not hold with the same code.
const isPreconditionViolated = (error: unknown): boolean =>
	error instanceof DbApiError && error.code === ErrorCode.preconditionViolated;

suite('writeEvents', () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
		await container.start();
	}, containerStartTimeout);

	afterEach(async () => {
		await container.stop();
	}, integrationTimeout);

	test('writes a single event.', integrationTimeout, async (): Promise<void> => {
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
		const [writtenEvent] = writtenEvents;
		assert.ok(writtenEvent);
		assert.equal(writtenEvent.id, '0');
	});

	test('writes multiple events.', integrationTimeout, async (): Promise<void> => {
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

		const [firstWrittenEvent, secondWrittenEvent] = writtenEvents;
		assert.ok(firstWrittenEvent);
		assert.ok(secondWrittenEvent);

		assert.equal(firstWrittenEvent.id, '0');
		assert.equal(firstWrittenEvent.data.value, 23);

		assert.equal(secondWrittenEvent.id, '1');
		assert.equal(secondWrittenEvent.data.value, 42);
	});

	test('writes the trace context of an event.', integrationTimeout, async (): Promise<void> => {
		const client = container.getClient();

		const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
		const tracestate = 'rojo=00f067aa0ba902b7';

		const event: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 42,
			},
			traceparent,
			tracestate,
		};

		const writtenEvents = await client.writeEvents([event]);

		assert.equal(writtenEvents.length, 1);
		const [writtenEvent] = writtenEvents;
		assert.ok(writtenEvent);
		assert.equal(writtenEvent.traceparent, traceparent);
		assert.equal(writtenEvent.tracestate, tracestate);

		const eventsRead: Event[] = [];
		for await (const eventRead of client.readEvents('/test', {
			recursive: false,
		})) {
			eventsRead.push(eventRead);
		}

		assert.equal(eventsRead.length, 1);
		const [eventRead] = eventsRead;
		assert.ok(eventRead);
		assert.equal(eventRead.traceparent, traceparent);
		assert.equal(eventRead.tracestate, tracestate);
	});

	test(
		'supports the isSubjectPristine precondition.',
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

			await client.writeEvents([firstEvent]);

			const secondEvent: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test',
				type: 'io.eventsourcingdb.test',
				data: {
					value: 42,
				},
			};

			await assert.rejects(async () => {
				await client.writeEvents([secondEvent], [isSubjectPristine('/test')]);
			}, isPreconditionViolated);
		},
	);

	test(
		'supports the isSubjectPopulated precondition.',
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

			await assert.rejects(async () => {
				await client.writeEvents([secondEvent], [isSubjectPopulated('/test')]);
			}, isPreconditionViolated);

			await client.writeEvents([firstEvent]);

			const writtenEvents = await client.writeEvents([secondEvent], [isSubjectPopulated('/test')]);

			assert.equal(writtenEvents.length, 1);
			const [writtenEvent] = writtenEvents;
			assert.ok(writtenEvent);
			assert.equal(writtenEvent.id, '1');
			assert.equal(writtenEvent.data.value, 42);
		},
	);

	test(
		'supports the isSubjectOnEventId precondition.',
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

			await client.writeEvents([firstEvent]);

			const secondEvent: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test',
				type: 'io.eventsourcingdb.test',
				data: {
					value: 42,
				},
			};

			await assert.rejects(async () => {
				await client.writeEvents([secondEvent], [isSubjectOnEventId('/test', '1')]);
			}, isPreconditionViolated);
		},
	);

	test(
		'supports the isEventQlQueryTrue precondition.',
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

			await client.writeEvents([firstEvent]);

			const secondEvent: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test',
				type: 'io.eventsourcingdb.test',
				data: {
					value: 42,
				},
			};

			await assert.rejects(async () => {
				await client.writeEvents(
					[secondEvent],
					[isEventQlQueryTrue('FROM e IN events PROJECT INTO COUNT() == 0')],
				);
			}, isPreconditionViolated);
		},
	);
});
