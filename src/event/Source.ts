import type { UnknownObject } from '../util/UnknownObject.js';
import { EventCandidate } from './EventCandidate.js';

class Source {
	public readonly source: string;

	public constructor(source: string) {
		this.source = source;
	}

	public newEvent(
		subject: string,
		type: string,
		data: UnknownObject,
		traceParent?: string,
		traceState?: string,
	): EventCandidate {
		return new EventCandidate(this.source, subject, type, data, traceParent, traceState);
	}
}

export { Source };
