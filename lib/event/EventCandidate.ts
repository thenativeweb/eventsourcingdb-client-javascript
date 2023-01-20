import { validateSubject } from './validateSubject';
import { validateType } from './validateType';

class EventCandidate {
	public readonly data: Record<string, unknown>;

	public readonly source: string;

	public readonly subject: string;

	public readonly type: string;

	public constructor(data: Record<string, unknown>, source: string, subject: string, type: string) {
		this.data = data;
		this.source = source;
		this.subject = subject;
		this.type = type;
	}

	public validate(): void {
		validateSubject(this.subject);
		validateType(this.type);
	}
}

export { EventCandidate };
