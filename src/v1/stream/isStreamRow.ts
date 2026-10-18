import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamRow } from './StreamRow.js';

const isStreamRow = (line: unknown): line is StreamRow =>
	hasShapeOf<StreamRow>(line, {
		type: (value: unknown): value is 'row' => value === 'row',
		payload: (value: unknown): value is unknown => value !== undefined,
	});

export { isStreamRow };
