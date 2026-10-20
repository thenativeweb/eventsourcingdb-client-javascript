import type { CloudEvent } from './CloudEvent.js';
import { Event } from './Event.js';
import { getRawJsonMember } from './json/getRawJsonMember.js';

// The hash of an event covers its data exactly as the server sent it, so the
// event keeps the data from the text of the cloud event, byte for byte.
const convertCloudEventToEvent = (cloudEvent: CloudEvent, cloudEventText?: string): Event =>
	new Event({
		specversion: cloudEvent.specversion,
		id: cloudEvent.id,
		time: new Date(cloudEvent.time),
		timeFromServer: cloudEvent.time,
		source: cloudEvent.source,
		subject: cloudEvent.subject,
		type: cloudEvent.type,
		datacontenttype: cloudEvent.datacontenttype,
		data: cloudEvent.data,
		dataFromServer:
			(cloudEventText === undefined ? undefined : getRawJsonMember(cloudEventText, 'data')) ??
			JSON.stringify(cloudEvent.data),
		hash: cloudEvent.hash,
		predecessorhash: cloudEvent.predecessorhash,
		traceparent: cloudEvent.traceparent,
		tracestate: cloudEvent.tracestate,
		signature: cloudEvent.signature,
	});

export { convertCloudEventToEvent };
