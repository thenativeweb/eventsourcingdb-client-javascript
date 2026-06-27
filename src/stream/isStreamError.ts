import { hasShapeOf } from '../types/hasShapeOf.js';
import { isString } from '../types/isString.js';
import type { StreamError } from './StreamError.js';

const isStreamError = (line: unknown): line is StreamError =>
	hasShapeOf<StreamError>(line, {
		type: (value: unknown): value is 'error' => value === 'error',
		payload: {
			error: isString,
		},
	});

export { isStreamError };
