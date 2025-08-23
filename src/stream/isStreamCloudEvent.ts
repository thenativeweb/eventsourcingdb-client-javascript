import { isRecord } from 'src/types/isRecord.js';
import { isString } from 'src/types/isString.js';
import { isStringOrNull } from 'src/types/isStringOrNull.js';
import { isStringOrUndefined } from 'src/types/isStringOrUndefined.js';
import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamCloudEvent } from './StreamCloudEvent.js';

const isStreamCloudEvent = (line: unknown): line is StreamCloudEvent => {
	return hasShapeOf<StreamCloudEvent>(line, {
		type: value => value === 'event',
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
};

export { isStreamCloudEvent };
