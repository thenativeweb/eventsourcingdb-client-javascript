import { validateObserveEventsOptions } from '../../../../lib/handlers/observeEvents/ObserveEventsOptions';
import { ValidationError } from '../../../../lib/util/error/ValidationError';
import { assert } from 'assertthat';

suite('validateObserveEventOptions', () => {
	test('returns for a valid options object.', () => {
		assert
			.that(() =>
				validateObserveEventsOptions({
					recursive: false,
				}),
			)
			.is.not.throwing();
	});

	test('throws an error if the both lowerBoundId and fromLatestEvent were given.', () => {
		assert
			.that(() =>
				validateObserveEventsOptions({
					recursive: false,
					lowerBoundId: '1',
					fromLatestEvent: {
						subject: 'some-subject',
						type: 'some-type',
						ifEventIsMissing: 'wait-for-event',
					},
				}),
			)
			.is.throwing(
				(error) =>
					error.message ===
						'ObserveEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.' &&
					error instanceof ValidationError,
			);
	});
});
