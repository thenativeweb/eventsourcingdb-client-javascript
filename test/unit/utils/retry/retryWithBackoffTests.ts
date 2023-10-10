import { assert } from 'assertthat';
import { CancelationError } from '../../../../lib';
import { RetryError } from '../../../../lib/util/retry/RetryError';
import { done, retryWithBackoff } from '../../../../lib/util/retry/retryWithBackoff';

suite('retryWithBackoff', (): void => {
	test('returns immediately if no error occurs.', async (): Promise<void> => {
		let count = 0;
		const maxTries = 3;

		await assert
			.that(async () => {
				await retryWithBackoff(new AbortController(), maxTries, async () => {
					count += 1;

					return done;
				});
			})
			.is.not.throwingAsync();

		assert.that(count).is.equalTo(1);
	});

	test('throws a RetryError if an error occurs during all tries.', async (): Promise<void> => {
		let count = 0;
		const maxTries = 3;

		await assert
			.that(async () => {
				await retryWithBackoff(new AbortController(), maxTries, async () => {
					count += 1;

					return { retry: new Error(`Error no. ${count}`) };
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
		const maxTries = 5;
		const successfulTry = 3;

		await assert
			.that(async () => {
				await retryWithBackoff(new AbortController(), maxTries, async () => {
					count += 1;

					if (count !== successfulTry) {
						return { retry: new Error(`Error no. ${count}`) };
					}

					return done;
				});
			})
			.is.not.throwingAsync();

		assert.that(count).is.equalTo(successfulTry);
	});

	test('returns immediately when the AbortController is canceled.', async (): Promise<void> => {
		let count = 0;
		const maxTries = 5;
		const cancelingTry = 3;

		const abortController = new AbortController();

		await assert
			.that(async () => {
				await retryWithBackoff(abortController, maxTries, async () => {
					count += 1;

					if (count === cancelingTry) {
						abortController.abort();
					}

					return { retry: new Error(`Error no. ${count}`) };
				});
			})
			.is.throwingAsync((error) => error instanceof CancelationError);

		assert.that(count).is.equalTo(cancelingTry);
	});

	test('aborts the retries if an error is thrown.', async () => {
		// biome-ignore lint/correctness/noUnusedVariables: count is not a unused variable
		let count = 0;
		const maxTries = 5;
		const abortController = new AbortController();

		await assert
			.that(async () => {
				await retryWithBackoff(abortController, maxTries, async () => {
					count += 1;

					throw new Error('Abort the retries.');
				});
			})
			.is.throwingAsync((error) => !(error instanceof RetryError));
	});
});
