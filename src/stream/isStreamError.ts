import type { StreamError } from './StreamError.js';

const isStreamError = (line: unknown): line is StreamError => {
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
	if (line.type !== 'error') {
		return false;
	}

	if (!('payload' in line)) {
		return false;
	}
	if (typeof line.payload !== 'object') {
		return false;
	}
	if (line.payload === null) {
		return false;
	}
	if (Array.isArray(line.payload)) {
		return false;
	}

	if (!('error' in line.payload)) {
		return false;
	}
	if (typeof line.payload.error !== 'string') {
		return false;
	}

	return true;
};

export { isStreamError };
