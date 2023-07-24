import { UnknownObject } from '../util/UnknownObject';
import { TracingContext } from './tracing';
import { validateSubject } from './validateSubject';
import { validateType } from './validateType';

class EventCandidate {
	public readonly data: Record<string, unknown>;

	public readonly source: string;

	public readonly subject: string;

	public readonly type: string;

	public readonly tracingContext?: TracingContext;

	public constructor(
		source: string,
		subject: string,
		type: string,
		data: UnknownObject,
		tracingContext?: TracingContext,
	) {
		this.data = data;
		this.source = source;
		this.subject = subject;
		this.type = type;
		this.tracingContext = tracingContext;
	}

	public validate(): void {
		validateSubject(this.subject);
		validateType(this.type);

		this.tracingContext?.validate();
	}
}

export { EventCandidate };
