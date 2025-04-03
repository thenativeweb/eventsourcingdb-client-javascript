import { isCloudEvent } from '../isCloudEvent.js';
import type { StreamCloudEvent } from './StreamCloudEvent.js';

const isStreamCloudEvent = (line: unknown): line is StreamCloudEvent => {
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
	if (line.type !== 'event') {
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

	if (!isCloudEvent(line.payload)) {
		return false;
	}

	return true;
};

export { isStreamCloudEvent };
