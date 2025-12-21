import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamRow } from './StreamRow.js';

const isStreamRow = (line: unknown): line is StreamRow => {
	return hasShapeOf<StreamRow>(line, {
		type: value => value === 'row',
		payload: (value: unknown): value is unknown => value !== undefined,
	});
};

export { isStreamRow };
