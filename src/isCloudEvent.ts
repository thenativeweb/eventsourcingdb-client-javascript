import type { CloudEvent } from './CloudEvent.js';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This function is long, but the complexity is unfortunately needed.
const isCloudEvent = (value: unknown): value is CloudEvent => {
	if (typeof value !== 'object') {
		return false;
	}
	if (value === null) {
		return false;
	}
	if (Array.isArray(value)) {
		return false;
	}

	if (!('specversion' in value)) {
		return false;
	}
	if (typeof value.specversion !== 'string') {
		return false;
	}

	if (!('id' in value)) {
		return false;
	}
	if (typeof value.id !== 'string') {
		return false;
	}

	if (!('time' in value)) {
		return false;
	}
	if (typeof value.time !== 'string') {
		return false;
	}

	if (!('source' in value)) {
		return false;
	}
	if (typeof value.source !== 'string') {
		return false;
	}

	if (!('subject' in value)) {
		return false;
	}
	if (typeof value.subject !== 'string') {
		return false;
	}

	if (!('type' in value)) {
		return false;
	}
	if (typeof value.type !== 'string') {
		return false;
	}

	if (!('datacontenttype' in value)) {
		return false;
	}
	if (typeof value.datacontenttype !== 'string') {
		return false;
	}

	if (!('data' in value)) {
		return false;
	}
	if (typeof value.data !== 'object') {
		return false;
	}
	if (value.data === null) {
		return false;
	}
	if (Array.isArray(value.data)) {
		return false;
	}

	if (!('hash' in value)) {
		return false;
	}
	if (typeof value.hash !== 'string') {
		return false;
	}

	if (!('predecessorhash' in value)) {
		return false;
	}
	if (typeof value.predecessorhash !== 'string') {
		return false;
	}

	if ('traceparent' in value) {
		if (typeof value.traceparent !== 'string') {
			return false;
		}
	}
	if ('tracestate' in value) {
		if (typeof value.tracestate !== 'string') {
			return false;
		}
	}

	return true;
};

export { isCloudEvent };
