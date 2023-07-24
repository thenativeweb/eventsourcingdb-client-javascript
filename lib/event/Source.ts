import { UnknownObject } from '../util/UnknownObject';
import { EventCandidate } from './EventCandidate';
import { TracingContext } from './tracing';

class Source {
	public readonly source: string;

	public constructor(source: string) {
		this.source = source;
	}

	public newEvent(
		subject: string,
		type: string,
		data: UnknownObject,
		tracingContext?: TracingContext,
	): EventCandidate {
		return new EventCandidate(this.source, subject, type, data, tracingContext);
	}
}

export { Source };
