import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { getRawJsonElements } from './getRawJsonElements.js';

suite('getRawJsonElements', (): void => {
	test('returns the elements of an array exactly as the text contains them.', (): void => {
		const text = '[ {"a" : "]"} , "x,]" ,1.0,[ 2 ],null ]';

		assert.deepEqual(getRawJsonElements(text), ['{"a" : "]"}', '"x,]"', '1.0', '[ 2 ]', 'null']);
	});

	test('returns no elements for an empty array.', (): void => {
		assert.deepEqual(getRawJsonElements('[]'), []);
		assert.deepEqual(getRawJsonElements(' [ ] '), []);
	});

	test('returns no elements if the text is not an array.', (): void => {
		assert.deepEqual(getRawJsonElements('{"a":[1]}'), []);
	});
});
