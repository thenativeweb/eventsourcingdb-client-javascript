import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamError } from './StreamError.js';

const blueprint: StreamError = {
	type: 'error',
	payload: {
		error: 'string',
	},
};

const isStreamError = (line: unknown): line is StreamError => {
	if (!hasShapeOf(line, blueprint)) {
		return false;
	}
	if (line.type !== 'error') {
		return false;
	}

	return true;
};

export { isStreamError };
