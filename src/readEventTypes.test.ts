import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import type { EventCandidate } from './EventCandidate.js';
import { EventSourcingDbContainer } from './EventSourcingDbContainer.js';
import type { EventType } from './EventType.js';
import { getImageVersionFromDockerfile } from './getImageVersionFromDockerfile.js';

suite('readEventTypes', { timeout: 20_000 }, () => {
	let container: EventSourcingDbContainer;

	beforeEach(async () => {
		const imageVersion = getImageVersionFromDockerfile();
		container = new EventSourcingDbContainer().withImageTag(imageVersion);
		await container.start();
	});

	afterEach(async () => {
		await container.stop();
	});

	test('reads no event types if the database is empty.', async (): Promise<void> => {
		const client = container.getClient();

		let didReadEventTypes = false;
		for await (const _event of client.readEventTypes()) {
			didReadEventTypes = true;
		}

		assert.equal(didReadEventTypes, false);
	});

	test('reads all event types.', async (): Promise<void> => {
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
				eventType: 'io.eventsourcingdb.test.bar',
				isPhantom: false,
			},
			{
				eventType: 'io.eventsourcingdb.test.foo',
				isPhantom: false,
			},
		]);
	});

	test('supports reading event schemas.', async (): Promise<void> => {
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
		for await (const eventType of client.readEventTypes()) {
			eventTypesRead.push(eventType);
		}

		assert.deepEqual(eventTypesRead, [
			{
				eventType: 'io.eventsourcingdb.test',
				isPhantom: true,
				schema,
			},
		]);
	});
});
