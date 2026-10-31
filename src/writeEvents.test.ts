import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, type TestContext, test } from 'node:test';
import type { Client } from './Client.js';
import { Container } from './Container.js';
import { DbApiError } from './DbApiError.js';
import { ErrorCode } from './ErrorCode.js';
import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageTag } from './getImageTag.js';
import { IncompatibleServerError } from './IncompatibleServerError.js';
import { isEventQlQueryTrue } from './isEventQlQueryTrue.js';
import { isSubjectOnEventId } from './isSubjectOnEventId.js';
import { isSubjectPopulated } from './isSubjectPopulated.js';
import { isSubjectPristine } from './isSubjectPristine.js';
import type { Precondition } from './Precondition.js';
import { containerStartTimeout } from './testing/containerStartTimeout.js';
import { getApiVersionOf } from './testing/getApiVersionOf.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

// Both APIs report a precondition that does not hold with the same code.
const isPreconditionViolated = (error: unknown): boolean =>
	error instanceof DbApiError && error.code === ErrorCode.preconditionViolated;

const getEvent = (subject: string): EventCandidate => ({
	source: 'https://www.eventsourcingdb.io',
	subject,
	type: 'io.eventsourcingdb.test',
	data: {
		value: 23,
	},
});

// Writes one event on each of the subjects, one write after another.
const writeEventsOn = async (client: Client, subjects: string[]): Promise<void> => {
	for (const subject of subjects) {
		await client.writeEvents([getEvent(subject)]);
	}
};

const readAllEvents = async (client: Client): Promise<Event[]> => {
	const events: Event[] = [];
	for await (const event of client.readEvents('/', { recursive: true })) {
		events.push(event);
	}

	return events;
};

interface PreconditionOptionsCase {
	name: string;
	recursive: boolean;

	// The subjects of the events that the case writes first.
	subjects: string[];

	// A precondition that does not hold after these events, and one that does.
	// At least one of the two would turn out the other way with the other value
	// of the recursive option, so that the case tells the two values apart.
	violated: Precondition;
	holding: Precondition;
}

const preconditionOptionsCases: PreconditionOptionsCase[] = [
	{
		name: 'isSubjectPristine',
		recursive: true,
		subjects: ['/test/1'],
		violated: isSubjectPristine('/test', { recursive: true }),
		holding: isSubjectPristine('/test/2', { recursive: true }),
	},
	{
		name: 'isSubjectPristine',
		recursive: false,
		subjects: ['/test/1'],
		violated: isSubjectPristine('/test/1', { recursive: false }),
		holding: isSubjectPristine('/test', { recursive: false }),
	},
	{
		name: 'isSubjectPopulated',
		recursive: true,
		subjects: ['/test/1'],
		violated: isSubjectPopulated('/test/2', { recursive: true }),
		holding: isSubjectPopulated('/test', { recursive: true }),
	},
	{
		name: 'isSubjectPopulated',
		recursive: false,
		subjects: ['/test/1'],
		violated: isSubjectPopulated('/test', { recursive: false }),
		holding: isSubjectPopulated('/test/1', { recursive: false }),
	},
	{
		name: 'isSubjectOnEventId',
		recursive: true,
		subjects: ['/test', '/test/1'],
		violated: isSubjectOnEventId('/test', '0', { recursive: true }),
		holding: isSubjectOnEventId('/test', '1', { recursive: true }),
	},
	{
		name: 'isSubjectOnEventId',
		recursive: false,
		subjects: ['/test', '/test/1'],
		violated: isSubjectOnEventId('/test', '1', { recursive: false }),
		holding: isSubjectOnEventId('/test', '0', { recursive: false }),
	},
];

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

	const definePreconditionOptionsTests = ({
		name,
		recursive,
		subjects,
		violated,
		holding,
	}: PreconditionOptionsCase): void => {
		// The v1 API cannot check a recursive precondition, so the write fails
		// before it is sent, whether the precondition would hold or not.
		if (recursive) {
			test(
				`rejects the ${name} precondition with the recursive option set to true through the v1 API.`,
				integrationTimeout,
				async (context: TestContext): Promise<void> => {
					if ((await getApiVersionOf(container)) !== 'v1') {
						context.skip('The server offers the v2 API, which checks recursive preconditions.');
						return;
					}

					const client = container.getClient();
					await writeEventsOn(client, subjects);

					for (const precondition of [violated, holding]) {
						await assert.rejects(async () => {
							await client.writeEvents([getEvent('/test')], [precondition]);
						}, IncompatibleServerError);
					}

					assert.equal((await readAllEvents(client)).length, subjects.length);
				},
			);
		}

		test(
			`supports the ${name} precondition with the recursive option set to ${recursive}.`,
			integrationTimeout,
			async (context: TestContext): Promise<void> => {
				if (recursive && (await getApiVersionOf(container)) === 'v1') {
					context.skip(
						'The server offers only the v1 API, which cannot check recursive preconditions.',
					);
					return;
				}

				const client = container.getClient();
				await writeEventsOn(client, subjects);

				await assert.rejects(async () => {
					await client.writeEvents([getEvent('/test')], [violated]);
				}, isPreconditionViolated);

				const writtenEvents = await client.writeEvents([getEvent('/test')], [holding]);
				assert.equal(writtenEvents.length, 1);
			},
		);
	};

	for (const preconditionOptionsCase of preconditionOptionsCases) {
		definePreconditionOptionsTests(preconditionOptionsCase);
	}
});
