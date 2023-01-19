import { validateSubject } from './validateSubject';
import { validateType } from './validateType';

class EventCandidate {
	readonly #data: Record<string, unknown>;

	readonly #source: string;

	readonly #subject: string;

	readonly #type: string;

	public constructor(data: Record<string, unknown>, source: string, subject: string, type: string) {
		this.#data = data;
		this.#source = source;
		this.#subject = subject;
		this.#type = type;
	}

	public get data(): Record<string, unknown> {
		return this.#data;
	}

	public get source(): string {
		return this.#source;
	}

	public get subject(): string {
		return this.#subject;
	}

	public get type(): string {
		return this.#type;
	}

	public validate(): void {
		validateSubject(this.subject);
		validateType(this.type);
	}
}

export { EventCandidate };
