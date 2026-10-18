import { StallGuard } from './StallGuard.js';

// Runs a request that is not a stream under a stall guard. If the request
// stalls, it fails with the error of the stall, whatever fetch throws then.
const runWithStallGuard = async <TResult>(
	{ stallTimeout, signal }: { stallTimeout: number; signal?: AbortSignal },
	run: (stallGuard: StallGuard) => Promise<TResult>,
): Promise<TResult> => {
	const stallGuard = new StallGuard(stallTimeout, signal);

	try {
		stallGuard.restart();
		return await run(stallGuard);
	} catch (error) {
		stallGuard.throwIfStalled();
		throw error;
	} finally {
		stallGuard.dispose({ abortRequest: false });
	}
};

export { runWithStallGuard };
