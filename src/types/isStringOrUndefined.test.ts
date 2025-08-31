import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { isStringOrUndefined } from './isStringOrUndefined.js';

suite('isStringOrUndefined', (): void => {
	test('returns true for string values.', (): void => {
		assert.strictEqual(isStringOrUndefined('hello'), true);
		assert.strictEqual(isStringOrUndefined(String('hello')), true);
	});

	test('returns true for undefined values.', (): void => {
		assert.strictEqual(isStringOrUndefined(undefined), true);
	});

	test('returns false for non-string and non-undefined values.', (): void => {
		assert.strictEqual(isStringOrUndefined(0), false);
		assert.strictEqual(isStringOrUndefined(1), false);
		assert.strictEqual(isStringOrUndefined(true), false);
		assert.strictEqual(isStringOrUndefined(false), false);
		assert.strictEqual(isStringOrUndefined(null), false);
		assert.strictEqual(isStringOrUndefined({}), false);
		assert.strictEqual(isStringOrUndefined([]), false);
	});
});
