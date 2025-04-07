import type { StreamEventType } from './StreamEventType.js';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This function is long, but the complexity is unfortunately needed.
const isStreamEventType = (line: unknown): line is StreamEventType => {
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
	if (line.type !== 'eventType') {
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

	if (!('eventType' in line.payload)) {
		return false;
	}
	if (typeof line.payload.eventType !== 'string') {
		return false;
	}

	if (!('isPhantom' in line.payload)) {
		return false;
	}
	if (typeof line.payload.isPhantom !== 'boolean') {
		return false;
	}

	if ('schema' in line.payload) {
		if (typeof line.payload.schema !== 'object') {
			return false;
		}
		if (line.payload.schema === null) {
			return false;
		}
		if (Array.isArray(line.payload.schema)) {
			return false;
		}
	}

	return true;
};

export { isStreamEventType };
