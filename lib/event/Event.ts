import { UnknownObject } from '../util/UnknownObject';
import { isObject } from '../util/isObject';
import { EventContext } from './EventContext';

class Event extends EventContext {
	public readonly data: Record<string, unknown>;

	private constructor(
		data: Record<string, unknown>,
		source: string,
		subject: string,
		type: string,
		specVersion: string,
		id: string,
		time: Date,
		dataContentType: string,
		predecessorHash: string,
		traceParent?: string,
		traceState?: string,
	) {
		super(
			source,
			subject,
			type,
			specVersion,
			id,
			time,
			dataContentType,
			predecessorHash,
			traceParent,
			traceState,
		);
		this.data = data;
	}

	public static parse(unknownObject: UnknownObject): Event {
		const eventContext = super.parse(unknownObject);
		if (!isObject(unknownObject.data)) {
			throw new Error(`Failed to parse data '${unknownObject.data}' to object.`);
		}

		return new Event(
			unknownObject.data,
			eventContext.source,
			eventContext.subject,
			eventContext.type,
			eventContext.specVersion,
			eventContext.id,
			eventContext.time,
			eventContext.dataContentType,
			eventContext.predecessorHash,
			eventContext.traceParent,
			eventContext.traceState,
		);
	}

	public toJSON(): Record<string, unknown> {
		return {
			...super.toJSON(),
			data: this.data,
		};
	}
}

export { Event };
