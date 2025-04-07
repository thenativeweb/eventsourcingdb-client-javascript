import type { CloudEvent } from './CloudEvent.js';
import { hasShapeOf } from './types/hasShapeOf.js';

const blueprint: CloudEvent = {
	specversion: 'string',
	id: 'string',
	time: 'string',
	source: 'string',
	subject: 'string',
	type: 'string',
	datacontenttype: 'string',
	data: {},
	hash: 'string',
	predecessorhash: 'string',
};

const isCloudEvent = (value: unknown): value is CloudEvent => {
	return hasShapeOf(value, blueprint);
};

export { isCloudEvent };
