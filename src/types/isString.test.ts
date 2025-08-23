import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { isString } from './isString.js';

suite('isString', (): void => {
	test('returns true for string values.', (): void => {
		assert.strictEqual(isString('hello'), true);
		assert.strictEqual(isString(String('hello')), true);
	});

	test('returns false for non-string values.', (): void => {
		assert.strictEqual(isString(0), false);
		assert.strictEqual(isString(1), false);
		assert.strictEqual(isString(true), false);
		assert.strictEqual(isString(false), false);
		assert.strictEqual(isString(null), false);
		assert.strictEqual(isString(undefined), false);
		assert.strictEqual(isString({}), false);
		assert.strictEqual(isString([]), false);
	});
});
