import { UnknownObject } from '../util/UnknownObject';
import { ValidationError } from '../util/error/ValidationError';
import { validateSubject } from './validateSubject';
import { validateType } from './validateType';

class EventCandidate {
	public readonly data: Record<string, unknown>;
	public readonly source: string;
	public readonly subject: string;
	public readonly type: string;
	public readonly traceParent?: string;
	public readonly traceState?: string;

	public constructor(
		source: string,
		subject: string,
		type: string,
		data: UnknownObject,
		traceParent?: string,
		traceState?: string,
	) {
		this.data = data;
		this.source = source;
		this.subject = subject;
		this.type = type;
		this.traceParent = traceParent;
		this.traceState = traceState;
	}

	public validate(): void {
		validateSubject(this.subject);
		validateType(this.type);

		if (this.traceState !== undefined && this.traceParent === undefined) {
			throw new ValidationError(
				'Failed to validate trace state: trace parent must be set if trace state is set.',
			);
		}
	}

	public toJSON(): Record<string, unknown> {
		return {
			data: this.data,
			source: this.source,
			subject: this.subject,
			type: this.type,
			traceparent: this.traceParent,
			tracestate: this.traceState,
		};
	}
}

export { EventCandidate };
