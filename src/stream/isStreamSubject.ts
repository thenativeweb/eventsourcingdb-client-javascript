import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamSubject } from './StreamSubject.js';

const blueprint: StreamSubject = {
	type: 'subject',
	payload: {
		subject: 'string',
	},
};

const isStreamSubject = (line: unknown): line is StreamSubject => {
	return hasShapeOf(line, blueprint);
};

export { isStreamSubject };
