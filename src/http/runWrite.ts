import { DbApiError } from '../DbApiError.js';
import { OutcomeUnknownError } from '../OutcomeUnknownError.js';
import { isConnectionFailure } from './isConnectionFailure.js';

// Runs a write that has not been sent yet. A write certainly was not stored if
// the caller aborted before it was sent, if it could not establish a
// connection, or if the server refused it, which isRefusal tells for an error
// that the server reports. Every other failure may come after the server
// stored the write, so it fails with an OutcomeUnknownError that wraps it.
const runWrite = async <TResult>(
	{ signal, isRefusal }: { signal?: AbortSignal; isRefusal: (error: DbApiError) => boolean },
	write: () => Promise<TResult>,
): Promise<TResult> => {
	signal?.throwIfAborted();

	try {
		return await write();
	} catch (error) {
		if (isConnectionFailure(error)) {
			throw error;
		}
		if (error instanceof DbApiError && isRefusal(error)) {
			throw error;
		}

		throw new OutcomeUnknownError({ cause: error });
	}
};

export { runWrite };
