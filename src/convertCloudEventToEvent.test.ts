import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import type { CloudEvent } from './CloudEvent.js';
import { convertCloudEventToEvent } from './convertCloudEventToEvent.js';

suite('convertCloudEventToEvent', () => {
	test('converts a cloud event to an event.', () => {
		const now = Date.now();

		const cloudEvent: CloudEvent = {
			specversion: '1.0',
			id: '123',
			time: new Date(now).toISOString(),
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			datacontenttype: 'application/json',
			data: { key: 'value' },
			hash: '55a1f59420da66b2c4c87b565660054cff7c2aad5ebe5f56e04ae0f2a20f00a9',
			predecessorhash: '4f67e993373952b6b6733a9b99de21842c42ed68ff881169ac914488b49dfeef',
		};

		const event = convertCloudEventToEvent(cloudEvent);

		assert.strictEqual(event.specversion, cloudEvent.specversion);
		assert.strictEqual(event.id, cloudEvent.id);
		assert.deepStrictEqual(event.time, new Date(now));
		assert.strictEqual(event.source, cloudEvent.source);
		assert.strictEqual(event.subject, cloudEvent.subject);
		assert.strictEqual(event.type, cloudEvent.type);
		assert.strictEqual(event.datacontenttype, cloudEvent.datacontenttype);
		assert.deepStrictEqual(event.data, cloudEvent.data);
		assert.deepStrictEqual(event.hash, cloudEvent.hash);
		assert.deepStrictEqual(event.predecessorhash, cloudEvent.predecessorhash);
	});
});
