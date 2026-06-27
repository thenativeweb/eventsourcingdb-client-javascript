import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamHeartbeat } from './StreamHeartbeat.js';

const isStreamHeartbeat = (line: unknown): line is StreamHeartbeat =>
	hasShapeOf<StreamHeartbeat>(line, {
		type: (value: unknown): value is 'heartbeat' => value === 'heartbeat',
	});

export { isStreamHeartbeat };
