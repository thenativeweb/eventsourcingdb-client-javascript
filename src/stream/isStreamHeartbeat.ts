import type { StreamHeartbeat } from './StreamHeartbeat.js';

const isStreamHeartbeat = (line: unknown): line is StreamHeartbeat => {
	if (typeof line !== 'object') {
		return false;
	}
	if (line === null) {
		return false;
	}
	if (Array.isArray(line)) {
		return false;
	}

	if (!('type' in line)) {
		return false;
	}
	if (line.type !== 'heartbeat') {
		return false;
	}

	return true;
};

export { isStreamHeartbeat };
