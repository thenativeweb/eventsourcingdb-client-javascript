import { isAbortError } from '../http/isAbortError.js';
import { StallGuard } from './StallGuard.js';

// Runs a request that is a stream under a stall guard. If the request stalls,
// the stream fails with the error of the stall, whatever fetch throws then. If
// the caller aborts, the stream ends without an error. Ending the stream early
// closes the connection of the request.
const streamWithStallGuard = async function* <TItem>(
	{ stallTimeout, signal }: { stallTimeout: number; signal?: AbortSignal },
	stream: (stallGuard: StallGuard) => AsyncGenerator<TItem, void, void>,
): AsyncGenerator<TItem, void, void> {
	const stallGuard = new StallGuard(stallTimeout, signal);

	try {
		stallGuard.restart();
		yield* stream(stallGuard);

		stallGuard.throwIfStalled();
	} catch (error) {
		stallGuard.throwIfStalled();

		if (isAbortError(error)) {
			return;
		}
		throw error;
	} finally {
		stallGuard.dispose({ abortRequest: true });
	}
};

export { streamWithStallGuard };
