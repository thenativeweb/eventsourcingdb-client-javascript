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
	return hasShapeOf(line, blueprint);
};

export { isStreamEventType };
