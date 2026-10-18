import { defaultStallTimeout } from './stall/defaultStallTimeout.js';
import { formatDuration } from './stall/formatDuration.js';

// Extends TypeError, since fetch fails with a TypeError if a request stalls
// for longer than its own timeouts allow, so code that catches that keeps
// working. For the same reason, its cause carries the code of the timeout
// error of fetch for the same situation.
class ConnectionStalledError extends TypeError {
	public constructor(stallTimeout: number = defaultStallTimeout, options?: ErrorOptions) {
		super(`Nothing arrived from the server for ${formatDuration(stallTimeout)}.`, options);
		this.name = 'ConnectionStalledError';
	}
}

export { ConnectionStalledError };
