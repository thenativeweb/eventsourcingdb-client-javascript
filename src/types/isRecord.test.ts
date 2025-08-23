import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { isRecord } from './isRecord.js';

suite('isRecord', (): void => {
	test('returns true for a record.', (): void => {
		const value = { foo: 'bar' };
		assert.ok(isRecord(value));
	});

	test('returns false for null.', (): void => {
		const value: null = null;
		assert.ok(!isRecord(value));
	});

	test('returns false for an array.', (): void => {
		const value: unknown[] = [];
		assert.ok(!isRecord(value));
	});

	test('returns false for a primitive type.', (): void => {
		const value = 'foo';
		assert.ok(!isRecord(value));
	});
});
