import { DbApiError } from '../DbApiError.js';
import { OutcomeUnknownError } from '../OutcomeUnknownError.js';
import { trackSending } from './trackSending.js';

// Runs a write that has not been sent yet. A write certainly was not stored if
// it failed before its request went out, whether the caller aborted it, it
// stalled, or it could not establish a connection, or if the server refused
// it, which isRefusal tells for an error that the server reports. Every other
// failure may come after the server stored the write, so it fails with an
// OutcomeUnknownError that wraps it.
const runWrite = async <TResult>(
	{ signal, isRefusal }: { signal?: AbortSignal; isRefusal: (error: DbApiError) => boolean },
	write: () => Promise<TResult>,
): Promise<TResult> => {
	signal?.throwIfAborted();

	const outcome = await trackSending(write);
	if ('result' in outcome) {
		return outcome.result;
	}

	const { error, hasBeenSent } = outcome;
	if (!hasBeenSent) {
		throw error;
	}
	if (error instanceof DbApiError && isRefusal(error)) {
		throw error;
	}

	throw new OutcomeUnknownError({ cause: error });
};

export { runWrite };
