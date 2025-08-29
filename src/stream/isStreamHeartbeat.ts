import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamHeartbeat } from './StreamHeartbeat.js';

const isStreamHeartbeat = (line: unknown): line is StreamHeartbeat => {
	return hasShapeOf<StreamHeartbeat>(line, {
		type: value => value === 'heartbeat',
	});
};

export { isStreamHeartbeat };
