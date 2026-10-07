import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageVersionFromDockerfile } from './getImageVersionFromDockerfile.js';
import { isEventQlQueryTrue } from './isEventQlQueryTrue.js';
import { isSubjectOnEventId } from './isSubjectOnEventId.js';
import { isSubjectPopulated } from './isSubjectPopulated.js';
import { isSubjectPristine } from './isSubjectPristine.js';

suite('writeEvents', { timeout: 30_000 }, () => {
	let container: Container;

	beforeEach(async () => {
		const imageVersion = getImageVersionFromDockerfile();
		container = new Container().withImageTag(imageVersion);
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
		const [writtenEvent] = writtenEvents;
		assert.ok(writtenEvent);
		assert.equal(writtenEvent.id, '0');
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

		const [firstWrittenEvent, secondWrittenEvent] = writtenEvents;
		assert.ok(firstWrittenEvent);
		assert.ok(secondWrittenEvent);

		assert.equal(firstWrittenEvent.id, '0');
		assert.equal(firstWrittenEvent.data.value, 23);

		assert.equal(secondWrittenEvent.id, '1');
		assert.equal(secondWrittenEvent.data.value, 42);
	});

	test('writes the trace context of an event.', async (): Promise<void> => {
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

	test('supports the isSubjectPopulated precondition.', async (): Promise<void> => {
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

		await assert.rejects(
			async () => {
				await client.writeEvents([secondEvent], [isSubjectPopulated('/test')]);
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

		await client.writeEvents([firstEvent]);

		const writtenEvents = await client.writeEvents([secondEvent], [isSubjectPopulated('/test')]);

		assert.equal(writtenEvents.length, 1);
		const [writtenEvent] = writtenEvents;
		assert.ok(writtenEvent);
		assert.equal(writtenEvent.id, '1');
		assert.equal(writtenEvent.data.value, 42);
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

	test('supports the isEventQlQueryTrue precondition.', async (): Promise<void> => {
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
				await client.writeEvents(
					[secondEvent],
					[isEventQlQueryTrue('FROM e IN events PROJECT INTO COUNT() == 0')],
				);
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
