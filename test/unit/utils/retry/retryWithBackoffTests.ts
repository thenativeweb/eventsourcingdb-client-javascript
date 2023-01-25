import { assert } from 'assertthat';
import { CancelationError } from '../../../../lib';
import { retryWithBackoff } from '../../../../lib/util/retry/retryWithBackoff';

suite('retryWithBackoff()', (): void => {
	test('returns immediately if no error occurs.', async (): Promise<void> => {
		let count = 0;
		let maxTries = 3;

		await assert
			.that(async () => {
				await retryWithBackoff(new AbortController(), maxTries, async () => {
					count += 1;
				});
			})
			.is.not.throwingAsync();

		assert.that(count).is.equalTo(1);
	});

	test('throws a RetryError if an error occurs during all tries.', async (): Promise<void> => {
		let count = 0;
		let maxTries = 3;

		await assert
			.that(async () => {
				await retryWithBackoff(new AbortController(), maxTries, async () => {
					count += 1;

					throw new Error(`Error no. ${count}`);
				});
			})
			.is.throwingAsync(
				'Failed operation with 3 errors:\n' +
					'Error: Error no. 1\n' +
					'Error: Error no. 2\n' +
					'Error: Error no. 3',
			);

		assert.that(count).is.equalTo(maxTries);
	});

	test('returns when no error occurs anymore.', async (): Promise<void> => {
		let count = 0;
		let maxTries = 5;
		const successfulTry = 3;

		await assert
			.that(async () => {
				await retryWithBackoff(new AbortController(), maxTries, async () => {
					count += 1;

					if (count !== successfulTry) {
						throw new Error(`Error no. ${count}`);
					}
				});
			})
			.is.not.throwingAsync();

		assert.that(count).is.equalTo(successfulTry);
	});

	test('returns immediately when the AbortController is canceled.', async (): Promise<void> => {
		let count = 0;
		let maxTries = 5;
		const cancelingTry = 3;

		const abortController = new AbortController();

		await assert
			.that(async () => {
				await retryWithBackoff(abortController, maxTries, async () => {
					count += 1;

					if (count === cancelingTry) {
						abortController.abort();
					}

					throw new Error(`Error no. ${count}`);
				});
			})
			.is.throwingAsync((error) => error instanceof CancelationError);

		assert.that(count).is.equalTo(cancelingTry);
	});
});
