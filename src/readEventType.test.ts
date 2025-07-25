import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageVersionFromDockerfile } from './getImageVersionFromDockerfile.js';

suite('readEventType', { timeout: 20_000 }, () => {
	let container: Container;

	beforeEach(async () => {
		const imageVersion = getImageVersionFromDockerfile();
		container = new Container().withImageTag(imageVersion);
		await container.start();
	});

	afterEach(async () => {
		await container.stop();
	});

	test('fails if the event type does not exist.', async (): Promise<void> => {
		const client = container.getClient();

		await assert.rejects(
			async () => {
				await client.readEventType('non.existent.eventType');
			},
			{
				name: 'Error',
				message: "Failed to read event type, got HTTP status code '404', expected '200'.",
			},
		);
	});

	test('fails if the evenet type is malformed.', async (): Promise<void> => {
		const client = container.getClient();

		await assert.rejects(
			async () => {
				await client.readEventType('malformed.eventType.');
			},
			{
				name: 'Error',
				message: "Failed to read event type, got HTTP status code '400', expected '200'.",
			},
		);
	});

	test('read an existing event type.', async (): Promise<void> => {
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

		const readEventType = await client.readEventType('io.eventsourcingdb.test.foo');
		assert.equal(readEventType.eventType, 'io.eventsourcingdb.test.foo');
		assert.equal(readEventType.isPhantom, false);
		assert.equal(readEventType.schema, undefined);
	});
});
