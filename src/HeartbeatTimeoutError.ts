import { defaultStallTimeout } from './stall/defaultStallTimeout.js';
import { formatDuration } from './stall/formatDuration.js';

class HeartbeatTimeoutError extends Error {
	public constructor(stallTimeout: number = defaultStallTimeout) {
		super(`No event and no heartbeat arrived for ${formatDuration(stallTimeout)}.`);
		this.name = 'HeartbeatTimeoutError';
	}
}

export { HeartbeatTimeoutError };
