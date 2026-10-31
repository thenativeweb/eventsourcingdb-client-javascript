import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import { DbApiError } from './DbApiError.js';
import { ErrorCode } from './ErrorCode.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageTag } from './getImageTag.js';
import { containerStartTimeout } from './testing/containerStartTimeout.js';
import { getApiVersionOf } from './testing/getApiVersionOf.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

suite('readEventType', () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
		await container.start();
	}, containerStartTimeout);

	afterEach(async () => {
		await container.stop();
	}, integrationTimeout);

	test('fails if the event type does not exist.', integrationTimeout, async (): Promise<void> => {
		const client = container.getClient();

		const apiVersion = await getApiVersionOf(container);

		await assert.rejects(
			async () => {
				await client.readEventType('non.existent.eventType');
			},
			(error: unknown): boolean => {
				assert.ok(error instanceof DbApiError);
				assert.equal(error.code, ErrorCode.eventTypeUnknown);
				assert.equal(error.status, apiVersion === 'v1' ? 404 : 200);
				return true;
			},
		);
	});

	test('fails if the event type is malformed.', integrationTimeout, async (): Promise<void> => {
		const client = container.getClient();
		const apiVersion = await getApiVersionOf(container);

		// The v1 API has no code for a malformed event type.
		const expected =
			apiVersion === 'v1'
				? { code: undefined, status: 400 }
				: { code: ErrorCode.eventTypeMalformed, status: 200 };

		await assert.rejects(
			async () => {
				await client.readEventType('malformed.eventType.');
			},
			(error: unknown): boolean => {
				assert.ok(error instanceof DbApiError);
				assert.equal(error.code, expected.code);
				assert.equal(error.status, expected.status);
				return true;
			},
		);
	});

	test('read an existing event type.', integrationTimeout, async (): Promise<void> => {
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
		assert.deepEqual(readEventType, {
			type: 'io.eventsourcingdb.test.foo',
			hasEvents: true,
		});
	});

	test(
		'reads an event type that has a schema, but no events.',
		integrationTimeout,
		async (): Promise<void> => {
			const client = container.getClient();

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

			await client.registerEventSchema('io.eventsourcingdb.test.foo', schema);

			const readEventType = await client.readEventType('io.eventsourcingdb.test.foo');
			assert.deepEqual(readEventType, {
				type: 'io.eventsourcingdb.test.foo',
				hasEvents: false,
				schema,
			});
		},
	);
});
