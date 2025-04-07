import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamSubject } from './StreamSubject.js';

const blueprint: StreamSubject = {
	type: 'subject',
	payload: {
		subject: 'string',
	},
};

const isStreamSubject = (line: unknown): line is StreamSubject => {
	if (!hasShapeOf(line, blueprint)) {
		return false;
	}
	if (line.type !== 'subject') {
		return false;
	}

	return true;
};

export { isStreamSubject };
