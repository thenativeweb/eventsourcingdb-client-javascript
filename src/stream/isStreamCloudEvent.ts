import { hasShapeOf } from '../types/hasShapeOf.js';
import type { StreamCloudEvent } from './StreamCloudEvent.js';

const blueprint: StreamCloudEvent = {
	type: 'event',
	payload: {
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
	},
};

const isStreamCloudEvent = (line: unknown): line is StreamCloudEvent => {
	return hasShapeOf(line, blueprint);
};

export { isStreamCloudEvent };
