import { assert } from 'assertthat';
import { isObject } from '../../../lib/util/isObject.js';

suite('isObject()', (): void => {
	test('returns false if the given value is not an object.', (): void => {
		assert.that(isObject(1)).is.false();
		assert.that(isObject('')).is.false();
		assert.that(isObject([])).is.false();
		assert.that(isObject(null)).is.false();
		assert.that(isObject(undefined)).is.false();
		assert.that(isObject(true)).is.false();
	});

	test('returns true if the given value is an object.', (): void => {
		assert.that(isObject({})).is.true();
		assert.that(isObject(new Map())).is.true();
	});
});
