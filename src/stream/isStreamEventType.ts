import { hasShapeOf } from '../types/hasShapeOf.js';
import { isBoolean } from '../types/isBoolean.js';
import { isString } from '../types/isString.js';
import type { StreamEventType } from './StreamEventType.js';

const isStreamEventType = (line: unknown): line is StreamEventType => {
	return hasShapeOf<StreamEventType>(line, {
		type: value => value === 'eventType',
		payload: {
			eventType: isString,
			isPhantom: isBoolean,
		},
	});
};

export { isStreamEventType };
