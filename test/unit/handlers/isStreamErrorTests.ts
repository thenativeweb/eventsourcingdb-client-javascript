import { assert } from 'assertthat';
import { isStreamError } from '../../../lib/handlers/isStreamError.js';

suite('isStreamError()', () => {
	test('returns true for a error object.', () => {
		assert
			.that(
				isStreamError({
					type: 'error',
					payload: {
						error: 'some-error',
					},
				}),
			)
			.is.true();
	});

	test('ignores additional attributes.', () => {
		assert
			.that(
				isStreamError({
					type: 'error',
					payload: {
						error: 'some-error',
					},
					additional: 'attribute',
				}),
			)
			.is.true();
	});

	test('returns false for a missing payload', () => {
		assert
			.that(
				isStreamError({
					type: 'error',
				}),
			)
			.is.false();
	});

	test('returns false for a invalid payload', () => {
		assert
			.that(
				isStreamError({
					type: 'error',
					payload: {},
				}),
			)
			.is.false();
	});

	test('returns false for a non error object', () => {
		assert
			.that(
				isStreamError({
					type: 'not-an-error',
					payload: {
						error: 'some-error',
					},
				}),
			)
			.is.false();
	});
});
