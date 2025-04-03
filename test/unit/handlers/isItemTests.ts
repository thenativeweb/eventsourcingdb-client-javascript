import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { isItem } from '../../../src/handlers/isItem.js';

suite('isItem', () => {
	test('returns true for a item object.', () => {
		assert.ok(
			isItem({
				type: 'item',
				payload: {
					event: {},
					hash: 'some-hash',
				},
			}),
		);
	});

	test('ignores additional attributes.', () => {
		assert.ok(
			isItem({
				type: 'item',
				payload: {
					event: {},
					hash: 'some-hash',
				},
				additional: 'attribute',
			}),
		);
	});

	test('returns false for a missing payload.', () => {
		assert.equal(
			isItem({
				type: 'item',
			}),
			false,
		);
	});

	test('returns false for a invalid payload.', () => {
		assert.equal(
			isItem({
				type: 'item',
				payload: {
					event: {},
				},
			}),
			false,
		);
	});

	test('returns false for a non item object.', () => {
		assert.equal(
			isItem({
				type: 'not-an-item',
				payload: {
					event: {},
					hash: 'some-hash',
				},
			}),
			false,
		);
	});
});
