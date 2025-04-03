import type { CloudEvent } from './CloudEvent.js';
import type { Event } from './Event.js';

const convertCloudEventToEvent = (cloudEvent: CloudEvent): Event => {
	return {
		...cloudEvent,
		time: new Date(cloudEvent.time),
	};
};

export { convertCloudEventToEvent };
