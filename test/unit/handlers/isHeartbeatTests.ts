import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { isHeartbeat } from '../../../lib/handlers/isHeartbeat.js';

suite('isHeartbeat', () => {
	test('returns true for a heartbeat object.', () => {
		assert.ok(
			isHeartbeat({
				type: 'heartbeat',
			}),
		);
	});

	test('ignores additional attributes.', () => {
		assert.ok(
			isHeartbeat({
				type: 'heartbeat',
				additional: 'attribute',
			}),
		);
	});

	test('returns false for a non heartbeat object.', () => {
		assert.equal(
			isHeartbeat({
				type: 'not-a-heartbeat',
			}),
			false,
		);
	});
});
