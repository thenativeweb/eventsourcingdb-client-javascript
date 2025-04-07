import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamHeartbeat } from './StreamHeartbeat.js';

const blueprint: StreamHeartbeat = {
	type: 'heartbeat',
};

const isStreamHeartbeat = (line: unknown): line is StreamHeartbeat => {
	if (!hasShapeOf(line, blueprint)) {
		return false;
	}
	if (line.type !== 'heartbeat') {
		return false;
	}

	return true;
};

export { isStreamHeartbeat };
