import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { isObject } from '../../../src/util/isObject.js';

suite('isObject', (): void => {
	test('returns false if the given value is not an object.', (): void => {
		assert.equal(isObject(1), false);
		assert.equal(isObject(''), false);
		assert.equal(isObject([]), false);
		assert.equal(isObject(null), false);
		assert.equal(isObject(undefined), false);
		assert.equal(isObject(true), false);
	});

	test('returns true if the given value is an object.', (): void => {
		assert.ok(isObject({}));
		assert.ok(isObject(new Map()));
	});
});
