import type { CloudEvent } from './CloudEvent.js';
import { hasShapeOf } from './types/hasShapeOf.js';
import { isRecord } from './types/isRecord.js';
import { isString } from './types/isString.js';
import { isStringOrNull } from './types/isStringOrNull.js';
import { isStringOrUndefined } from './types/isStringOrUndefined.js';

const isCloudEvent = (value: unknown): value is CloudEvent => {
	return hasShapeOf<CloudEvent>(value, {
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
	});
};

export { isCloudEvent };
