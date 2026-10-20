import { convertCloudEventToEvent } from '../convertCloudEventToEvent.js';
import type { Event } from '../Event.js';
import type { EventType } from '../EventType.js';
import { getRawJsonMember } from '../json/getRawJsonMember.js';
import { hasShapeOf } from '../types/hasShapeOf.js';
import { isBoolean } from '../types/isBoolean.js';
import { isRecord } from '../types/isRecord.js';
import { isString } from '../types/isString.js';
import { isStringOrNull } from '../types/isStringOrNull.js';
import type { V2Event } from './V2Event.js';
import type { V2Item } from './V2Item.js';

interface V2EventType {
	type: string;
	hasEvents: boolean;
	schema: Record<string, unknown> | null;
}

const isV2Event = (value: unknown): value is V2Event =>
	hasShapeOf<V2Event>(value, {
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
		traceparent: isStringOrNull,
		tracestate: isStringOrNull,
		signature: isStringOrNull,
	});

const isV2EventType = (value: unknown): value is V2EventType =>
	hasShapeOf<V2EventType>(value, {
		type: isString,
		hasEvents: isBoolean,
		schema: (schema: unknown): schema is Record<string, unknown> | null =>
			schema === null || isRecord(schema),
	});

// The hash of an event covers its data exactly as the server sent it, so the
// event keeps the text of its data from the text of the item.
const convertV2ItemToEvent = (item: V2Item, action: string): Event => {
	if (!isV2Event(item.data)) {
		throw new Error(`Failed to ${action}, got an unexpected event.`);
	}

	const { traceparent, tracestate, ...cloudEvent } = item.data;

	return convertCloudEventToEvent(
		{
			...cloudEvent,
			...(traceparent === null ? {} : { traceparent }),
			...(tracestate === null ? {} : { tracestate }),
		},
		getRawJsonMember(item.text, 'data'),
	);
};

const convertV2ItemToEventType = (item: V2Item, action: string): EventType => {
	if (!isV2EventType(item.data)) {
		throw new Error(`Failed to ${action}, got an unexpected event type.`);
	}

	const { type, hasEvents, schema } = item.data;

	return {
		type,
		hasEvents,
		...(schema === null ? {} : { schema }),
	};
};

export { convertV2ItemToEvent, convertV2ItemToEventType };
