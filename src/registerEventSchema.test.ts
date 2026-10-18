import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import { DbApiError } from './DbApiError.js';
import { ErrorCode } from './ErrorCode.js';
import { getImageTag } from './getImageTag.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

suite('registerEventSchema', () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
		await container.start();
	}, integrationTimeout);

	afterEach(async () => {
		await container.stop();
	}, integrationTimeout);

	test('registers an event schema.', integrationTimeout, async (): Promise<void> => {
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

	test(
		'throws an error if an event schema is already registered.',
		integrationTimeout,
		async (): Promise<void> => {
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
				(error: unknown): boolean => {
					assert.ok(error instanceof DbApiError);
					assert.equal(error.code, ErrorCode.eventSchemaAlreadyRegistered);
					return true;
				},
			);
		},
	);
});
