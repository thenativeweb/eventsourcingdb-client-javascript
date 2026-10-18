import { defaultStallTimeout } from './stall/defaultStallTimeout.js';
import { formatDuration } from './stall/formatDuration.js';

// Extends TypeError, since fetch fails with a TypeError if a request stalls
// for longer than its own timeouts allow, so code that catches that keeps
// working.
class ConnectionStalledError extends TypeError {
	public constructor(stallTimeout: number = defaultStallTimeout) {
		super(`Nothing arrived from the server for ${formatDuration(stallTimeout)}.`);
		this.name = 'ConnectionStalledError';
	}
}

export { ConnectionStalledError };
