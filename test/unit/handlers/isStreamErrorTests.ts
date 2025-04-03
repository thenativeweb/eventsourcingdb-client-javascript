import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { isStreamError } from '../../../src/handlers/isStreamError.js';

suite('isStreamError', () => {
	test('returns true for a error object.', () => {
		assert.ok(
			isStreamError({
				type: 'error',
				payload: {
					error: 'some-error',
				},
			}),
		);
	});

	test('ignores additional attributes.', () => {
		assert.ok(
			isStreamError({
				type: 'error',
				payload: {
					error: 'some-error',
				},
				additional: 'attribute',
			}),
		);
	});

	test('returns false for a missing payload', () => {
		assert.equal(
			isStreamError({
				type: 'error',
			}),
			false,
		);
	});

	test('returns false for a invalid payload', () => {
		assert.equal(
			isStreamError({
				type: 'error',
				payload: {},
			}),
			false,
		);
	});

	test('returns false for a non error object', () => {
		assert.equal(
			isStreamError({
				type: 'not-an-error',
				payload: {
					error: 'some-error',
				},
			}),
			false,
		);
	});
});
