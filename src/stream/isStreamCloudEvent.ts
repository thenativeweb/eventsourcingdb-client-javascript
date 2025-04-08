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
	if (!hasShapeOf(line, blueprint)) {
		return false;
	}
	if (line.type !== 'event') {
		return false;
	}

	return true;
};

export { isStreamCloudEvent };
