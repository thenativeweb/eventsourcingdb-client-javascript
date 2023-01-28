import { UnknownObject } from '../util/UnknownObject';
import { Data } from './Data';
import { EventCandidate } from './EventCandidate';

class Source {
	public readonly source: string;

	public constructor(source: string) {
		this.source = source;
	}

	public newEvent(subject: string, type: string, data: Data): EventCandidate {
		return new EventCandidate(this.source, subject, type, data);
	}
}

export { Source };
