import { DbApiError } from '../DbApiError.js';
import { hasShapeOf } from '../types/hasShapeOf.js';
import { isRecord } from '../types/isRecord.js';
import { isString } from '../types/isString.js';
import type { V2Item } from './V2Item.js';

interface V2Envelope {
	type: string;
	data: unknown;
}

interface V2ErrorData {
	code: string;
	description: string;
	details: Record<string, unknown>;
}

const isV2Envelope = (value: unknown): value is V2Envelope =>
	hasShapeOf<V2Envelope>(value, {
		type: isString,
		data: (data: unknown): data is unknown => data !== undefined,
	});

const isV2ErrorData = (value: unknown): value is V2ErrorData =>
	hasShapeOf<V2ErrorData>(value, {
		code: isString,
		description: isString,
		details: isRecord,
	});

// Parses an answer or an item of a stream of the v2 API, each of which wraps
// its data in an envelope that names its type. An error item fails with the
// error that it describes, which the server reports at the status 200.
const parseV2Item = (value: unknown, text: string, action: string): V2Item => {
	if (!isV2Envelope(value)) {
		throw new Error(`Failed to ${action}, got an unexpected answer.`);
	}

	if (value.type === 'error') {
		if (!isV2ErrorData(value.data)) {
			throw new Error(`Failed to ${action}, got an unexpected error.`);
		}

		const { code, description, details } = value.data;
		throw new DbApiError({ status: 200, code, description, details });
	}

	return { type: value.type, data: value.data, text };
};

export { parseV2Item };
