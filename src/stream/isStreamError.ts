import { hasShapeOf } from '../types/hasShapeOf.js';
import { isString } from '../types/isString.js';
import type { StreamError } from './StreamError.js';

const isStreamError = (line: unknown): line is StreamError => {
	return hasShapeOf<StreamError>(line, {
		type: value => value === 'error',
		payload: {
			error: isString,
		},
	});
};

export { isStreamError };
