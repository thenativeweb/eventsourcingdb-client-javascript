import { CanceledError } from 'axios';
import { clearTimeout } from 'timers';
import { RetryError } from './RetryError';

const getRandomizedDuration = function (
	durationMilliseconds: number,
	deviationMilliseconds: number,
): number {
	const millseconds =
		durationMilliseconds -
		deviationMilliseconds +
		Math.round(Math.random() * deviationMilliseconds * 2);

	return millseconds;
};

const retryWithBackoff = async function <TReturn = void>(
	abortController: AbortController,
	tries: number,
	fn: () => Promise<TReturn>,
): Promise<TReturn> {
	if (tries < 1) {
		throw new RangeError('Tries must be greater than 0.');
	}

	const retryError = new RetryError();

	for (let triesCount = 0; triesCount < tries; triesCount++) {
		// On the first iteration triesCount is 0, so the timeout is 0, and we do not wait.
		const timeout = getRandomizedDuration(100, 25) * triesCount;

		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				resolve();
			}, timeout);

			abortController.signal.addEventListener('abort', () => {
				clearTimeout(timer);
				reject(new CanceledError());
			});
		});

		try {
			return fn();
		} catch (ex: unknown) {
			let error: Error;
			if (ex instanceof Error) {
				error = ex;
			} else {
				error = new Error(`Unknown error: ${ex}.`);
			}

			retryError.appendError(error);
		}
	}

	throw retryError;
};

export { retryWithBackoff };
