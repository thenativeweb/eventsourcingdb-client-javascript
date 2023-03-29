import { isItem } from '../../../lib/handlers/isItem';
import { assert } from 'assertthat';

suite('isItem()', () => {
	test('returns true for a item object.', () => {
		assert
			.that(
				isItem({
					type: 'item',
					payload: {
						event: {},
						hash: 'some-hash',
					},
				}),
			)
			.is.true();
	});

	test('ignores additional attributes.', () => {
		assert
			.that(
				isItem({
					type: 'item',
					payload: {
						event: {},
						hash: 'some-hash',
					},
					additional: 'attribute',
				}),
			)
			.is.true();
	});

	test('returns false for a missing payload.', () => {
		assert
			.that(
				isItem({
					type: 'item',
				}),
			)
			.is.false();
	});

	test('returns false for a invalid payload.', () => {
		assert
			.that(
				isItem({
					type: 'item',
					payload: {},
				}),
			)
			.is.false();
	});

	test('returns false for a non item object.', () => {
		assert
			.that(
				isItem({
					type: 'not-an-item',
					payload: {
						event: {},
						hash: 'some-hash',
					},
				}),
			)
			.is.false();
	});
});
