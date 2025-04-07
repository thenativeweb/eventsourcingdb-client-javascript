import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamError } from './StreamError.js';

const blueprint: StreamError = {
	type: 'error',
	payload: {
		error: 'string',
	},
};

const isStreamError = (line: unknown): line is StreamError => {
	return hasShapeOf(line, blueprint);
};

export { isStreamError };
