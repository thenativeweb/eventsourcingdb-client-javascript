import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { isStringOrNull } from './isStringOrNull.js';

suite('isStringOrNull', (): void => {
	test('returns true for string values.', (): void => {
		assert.strictEqual(isStringOrNull('hello'), true);
		assert.strictEqual(isStringOrNull(String('hello')), true);
	});

	test('returns true for null values.', (): void => {
		assert.strictEqual(isStringOrNull(null), true);
	});

	test('returns false for non-string and non-null values.', (): void => {
		assert.strictEqual(isStringOrNull(0), false);
		assert.strictEqual(isStringOrNull(1), false);
		assert.strictEqual(isStringOrNull(true), false);
		assert.strictEqual(isStringOrNull(false), false);
		assert.strictEqual(isStringOrNull(undefined), false);
		assert.strictEqual(isStringOrNull({}), false);
		assert.strictEqual(isStringOrNull([]), false);
	});
});
