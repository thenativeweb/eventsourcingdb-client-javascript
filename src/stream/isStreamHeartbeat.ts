import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamHeartbeat } from './StreamHeartbeat.js';

const blueprint: StreamHeartbeat = {
	type: 'heartbeat',
};

const isStreamHeartbeat = (line: unknown): line is StreamHeartbeat => {
	return hasShapeOf(line, blueprint);
};

export { isStreamHeartbeat };
