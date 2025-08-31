import { isRecord } from 'src/types/isRecord.js';
import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamRow } from './StreamRow.js';

const isStreamRow = (line: unknown): line is StreamRow => {
	return hasShapeOf<StreamRow>(line, {
		type: value => value === 'row',
		payload: isRecord,
	});
};

export { isStreamRow };
