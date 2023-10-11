import { clearTimeout } from 'timers';
import { CancelationError } from '../error/CancelationError';
import { RetryError } from './RetryError';

// biome-ignore lint/style/useNamingConvention: We want to use this return type
type RetryResult<TResult> =
	| {
			return: TResult;
	  }
	| {
			retry: Error;
	  };

const getRandomizedDuration = function (
	durationMilliseconds: number,
	deviationMilliseconds: number,
): number {
	const milliseconds =
		durationMilliseconds -
		deviationMilliseconds +
		Math.round(Math.random() * deviationMilliseconds * 2);

	return milliseconds;
};

// biome-ignore lint/style/useNamingConvention: We want to use this return type
const retryWithBackoff = async function <TReturn = void>(
	abortController: AbortController,
	tries: number,
	fn: () => Promise<RetryResult<TReturn>>,
): Promise<TReturn> {
	if (tries < 1) {
		throw new RangeError('Tries must be greater than 0.');
	}

	const retryError = new RetryError();

	for (let triesCount = 0; triesCount < tries; triesCount++) {
		// On the first iteration triesCount is 0, so the timeout is 0, and we do not wait.
		const timeout = getRandomizedDuration(100, 25) * triesCount;

		await new Promise<void>((resolve, reject) => {
			if (abortController.signal.aborted) {
				return reject(new CancelationError());
			}

			const handleAborted = () => {
				clearTimeout(timer);
				return reject(new CancelationError());
			};

			abortController.signal.addEventListener('abort', handleAborted);

			const timer = setTimeout(() => {
				abortController.signal.removeEventListener('abort', handleAborted);
				return resolve();
			}, timeout);
		});

		const result = await fn();

		if ('return' in result) {
			return result.return;
		}

		if ('retry' in result) {
			retryError.appendError(result.retry);
		}
	}

	throw retryError;
};

const done = { return: undefined };

export { retryWithBackoff, done };
