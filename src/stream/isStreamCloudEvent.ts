import { hasShapeOf } from '../types/hasShapeOf.js';
import { isRecord } from '../types/isRecord.js';
import { isString } from '../types/isString.js';
import { isStringOrNull } from '../types/isStringOrNull.js';
import { isStringOrUndefined } from '../types/isStringOrUndefined.js';
import type { StreamCloudEvent } from './StreamCloudEvent.js';

const isStreamCloudEvent = (line: unknown): line is StreamCloudEvent =>
	hasShapeOf<StreamCloudEvent>(line, {
		type: (value: unknown): value is 'event' => value === 'event',
		payload: {
			specversion: isString,
			id: isString,
			time: isString,
			source: isString,
			subject: isString,
			type: isString,
			datacontenttype: isString,
			data: isRecord,
			hash: isString,
			predecessorhash: isString,
			traceparent: isStringOrUndefined,
			tracestate: isStringOrUndefined,
			signature: isStringOrNull,
		},
	});

export { isStreamCloudEvent };
