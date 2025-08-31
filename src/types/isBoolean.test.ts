import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { isBoolean } from './isBoolean.js';

suite('isBoolean', (): void => {
	test('returns true for boolean values.', (): void => {
		assert.strictEqual(isBoolean(true), true);
		assert.strictEqual(isBoolean(false), true);
		assert.strictEqual(isBoolean(Boolean(true)), true);
		assert.strictEqual(isBoolean(Boolean(false)), true);
	});

	test('returns false for non-boolean values.', (): void => {
		assert.strictEqual(isBoolean(0), false);
		assert.strictEqual(isBoolean(1), false);
		assert.strictEqual(isBoolean('true'), false);
		assert.strictEqual(isBoolean('false'), false);
		assert.strictEqual(isBoolean(null), false);
		assert.strictEqual(isBoolean(undefined), false);
		assert.strictEqual(isBoolean({}), false);
		assert.strictEqual(isBoolean([]), false);
	});
});
