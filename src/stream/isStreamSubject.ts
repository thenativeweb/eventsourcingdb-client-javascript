import type { StreamSubject } from './StreamSubject.js';

const isStreamSubject = (line: unknown): line is StreamSubject => {
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
	if (line.type !== 'subject') {
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

	if (!('subject' in line.payload)) {
		return false;
	}
	if (typeof line.payload.subject !== 'string') {
		return false;
	}

	return true;
};

export { isStreamSubject };
