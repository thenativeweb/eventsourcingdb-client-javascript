import { isObject } from '../util/isObject';
import { StreamError } from './StreamError';

const isStreamError = (message: unknown): message is StreamError => {
	if (!isObject(message) || message.type !== 'error') {
		return false;
	}

	const { payload } = message;

	return isObject(payload) && typeof payload.error === 'string';
};

export { isStreamError };
