import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { validateObserveEventsOptions } from '../../../../lib/handlers/observeEvents/ObserveEventsOptions.js';
import { ValidationError } from '../../../../lib/util/error/ValidationError.js';

suite('validateObserveEventOptions', () => {
	test('returns for a valid options object.', () => {
		// Should not throw.
		validateObserveEventsOptions({
			recursive: false,
		});
	});

	test('throws an error if the both lowerBoundId and fromLatestEvent were given.', () => {
		assert.throws(
			() => {
				validateObserveEventsOptions({
					recursive: false,
					lowerBoundId: '1',
					fromLatestEvent: {
						subject: 'some-subject',
						type: 'some-type',
						ifEventIsMissing: 'wait-for-event',
					},
				});
			},
			error => {
				assert.ok(error instanceof ValidationError);
				assert.equal(
					'ObserveEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.',
					error.message,
				);
				return true;
			},
		);
	});
});
