import type { CloudEvent } from './CloudEvent.js';
import { Event } from './Event.js';

const convertCloudEventToEvent = (cloudEvent: CloudEvent): Event => {
	return new Event({
		specversion: cloudEvent.specversion,
		id: cloudEvent.id,
		time: new Date(cloudEvent.time),
		timeFromServer: cloudEvent.time,
		source: cloudEvent.source,
		subject: cloudEvent.subject,
		type: cloudEvent.type,
		datacontenttype: cloudEvent.datacontenttype,
		data: cloudEvent.data,
		hash: cloudEvent.hash,
		predecessorhash: cloudEvent.predecessorhash,
		traceparent: cloudEvent.traceparent,
		tracestate: cloudEvent.tracestate,
		signature: cloudEvent.signature,
	});
};

export { convertCloudEventToEvent };
