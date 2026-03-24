import { hasShapeOf } from '../types/hasShapeOf.js';
import { isString } from '../types/isString.js';
import type { StreamSubject } from './StreamSubject.js';

const isStreamSubject = (line: unknown): line is StreamSubject => {
	return hasShapeOf<StreamSubject>(line, {
		type: value => value === 'subject',
		payload: {
			subject: isString,
		},
	});
};

export { isStreamSubject };
