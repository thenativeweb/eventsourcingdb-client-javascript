import { hasShapeOf } from '../types/hasShapeOf.js';
import { isBoolean } from '../types/isBoolean.js';
import { isString } from '../types/isString.js';
import type { StreamEventType } from './StreamEventType.js';

const isStreamEventType = (line: unknown): line is StreamEventType =>
	hasShapeOf<StreamEventType>(line, {
		type: (value: unknown): value is 'eventType' => value === 'eventType',
		payload: {
			eventType: isString,
			isPhantom: isBoolean,
		},
	});

export { isStreamEventType };
