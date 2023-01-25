import { assert } from 'assertthat';
import { isHeartbeat } from '../../../lib/handlers/isHeartbeat';

suite('isHeartbeat()', () => {
	test('returns true for a heartbeat object.', () => {
		assert
			.that(
				isHeartbeat({
					type: 'heartbeat',
				}),
			)
			.is.true();
	});

	test('ignores additional attributes.', () => {
		assert
			.that(
				isHeartbeat({
					type: 'heartbeat',
					additional: 'attribute',
				}),
			)
			.is.true();
	});

	test('returns false for a non heartbeat object.', () => {
		assert
			.that(
				isHeartbeat({
					type: 'not-a-heartbeat',
				}),
			)
			.is.false();
	});
});
