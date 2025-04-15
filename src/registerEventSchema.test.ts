import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { EventSourcingDbContainer } from './EventSourcingDbContainer.js';

suite('registerEventSchema', { timeout: 30_000 }, () => {
	let container: EventSourcingDbContainer;

	beforeEach(async () => {
		container = new EventSourcingDbContainer();
		await container.start();
	});

	afterEach(async () => {
		await container.stop();
	});

	test('registers an event schema.', async (): Promise<void> => {
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

		// Should not throw.
		await client.registerEventSchema(eventType, schema);
	});

	test('throws an error if an event schema is already registered.', async (): Promise<void> => {
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

		await assert.rejects(
			async () => {
				await client.registerEventSchema(eventType, schema);
			},
			error => {
				assert.ok(error instanceof Error);
				assert.equal(
					error.message,
					`Failed to register event schema, got HTTP status code '409', expected '200'.`,
				);
				return true;
			},
		);
	});
});
