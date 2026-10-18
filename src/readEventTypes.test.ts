import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import type { EventCandidate } from './EventCandidate.js';
import type { EventType } from './EventType.js';
import { getImageTag } from './getImageTag.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

suite('readEventTypes', () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
		await container.start();
	}, integrationTimeout);

	afterEach(async () => {
		await container.stop();
	}, integrationTimeout);

	test(
		'reads no event types if the database is empty.',
		integrationTimeout,
		async (): Promise<void> => {
			const client = container.getClient();

			let didReadEventTypes = false;
			for await (const _event of client.readEventTypes()) {
				didReadEventTypes = true;
			}

			assert.equal(didReadEventTypes, false);
		},
	);

	test('reads all event types.', integrationTimeout, async (): Promise<void> => {
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

		const eventTypesRead: EventType[] = [];
		for await (const eventType of client.readEventTypes()) {
			eventTypesRead.push(eventType);
		}

		assert.deepEqual(eventTypesRead, [
			{
				type: 'io.eventsourcingdb.test.bar',
				hasEvents: true,
			},
			{
				type: 'io.eventsourcingdb.test.foo',
				hasEvents: true,
			},
		]);
	});

	test('supports reading event schemas.', integrationTimeout, async (): Promise<void> => {
		const client = container.getClient();

		const eventType = 'io.eventsourcingdb.test';
		const schema = {
			type: 'object',
			properties: {
				value: {
					type: 'number',
				},
			},
			required: ['value'],
			additionalProperties: false,
		};

		await client.registerEventSchema(eventType, schema);

		const eventTypesRead: EventType[] = [];
		for await (const eventTypeRead of client.readEventTypes()) {
			eventTypesRead.push(eventTypeRead);
		}

		assert.deepEqual(eventTypesRead, [
			{
				type: 'io.eventsourcingdb.test',
				hasEvents: false,
				schema,
			},
		]);
	});
});
