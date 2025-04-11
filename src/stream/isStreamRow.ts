import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamRow } from './StreamRow.js';

const blueprint: Omit<StreamRow, 'payload'> = {
	type: 'row',
};

const isStreamRow = (line: unknown): line is StreamRow => {
	if (!hasShapeOf(line, blueprint)) {
		return false;
	}
	if (line.type !== 'row') {
		return false;
	}
	if (!('payload' in line)) {
		return false;
	}

	return true;
};

export { isStreamRow };
