import { isObject } from '../util/isObject.js';
import type { StreamError } from './StreamError.js';

const isStreamError = (message: unknown): message is StreamError => {
	if (!isObject(message) || message.type !== 'error') {
		return false;
	}

	const { payload } = message;

	return isObject(payload) && typeof payload.error === 'string';
};

export { isStreamError };
