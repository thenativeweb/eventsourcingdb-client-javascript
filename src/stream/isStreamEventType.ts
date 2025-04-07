import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamEventType } from './StreamEventType.js';

const blueprint: StreamEventType = {
	type: 'eventType',
	payload: {
		eventType: 'string',
		isPhantom: true,
	},
};

const isStreamEventType = (line: unknown): line is StreamEventType => {
	if (!hasShapeOf(line, blueprint)) {
		return false;
	}
	if (line.type !== 'eventType') {
		return false;
	}

	return true;
};

export { isStreamEventType };
