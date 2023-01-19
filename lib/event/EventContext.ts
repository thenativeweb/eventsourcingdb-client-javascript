import { validateSubject } from './validateSubject';
import { validateType } from './validateType';
import { UnknownObject } from '../util/UnknownObject';

class EventContext {
	readonly #source: string;

	readonly #subject: string;

	readonly #type: string;

	readonly #specVersion: string;

	readonly #id: string;

	readonly #time: Date;

	readonly #dataContentType: string;

	readonly #predecessorHash: string;

	protected constructor(
		source: string,
		subject: string,
		type: string,
		specVersion: string,
		id: string,
		time: Date,
		dataContentType: string,
		predecessorHash: string,
	) {
		this.#source = source;
		this.#subject = subject;
		this.#type = type;
		this.#specVersion = specVersion;
		this.#id = id;
		this.#time = time;
		this.#dataContentType = dataContentType;
		this.#predecessorHash = predecessorHash;
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

	public get specVersion(): string {
		return this.#specVersion;
	}

	public get id(): string {
		return this.#id;
	}

	public get time(): Date {
		return this.#time;
	}

	public get dataContentType(): string {
		return this.#dataContentType;
	}

	public get predecessorHash(): string {
		return this.#predecessorHash;
	}

	public static parse(unknownObject: UnknownObject): EventContext {
		if (typeof unknownObject.source !== 'string') {
			throw new Error(`Failed to parse source '${unknownObject.source}' to string.`);
		}
		if (typeof unknownObject.subject !== 'string') {
			throw new Error(`Failed to parse subject '${unknownObject.subject}' to string.`);
		}
		validateSubject(unknownObject.subject);
		if (typeof unknownObject.type !== 'string') {
			throw new Error(`Failed to parse type '${unknownObject.type}' to string.`);
		}
		validateType(unknownObject.type);
		if (typeof unknownObject.specversion !== 'string') {
			throw new Error(`Failed to parse specVersion '${unknownObject.specversion}' to string.`);
		}
		if (typeof unknownObject.id !== 'string') {
			throw new Error(`Failed to parse id '${unknownObject.id}' to string.`);
		}
		if (typeof unknownObject.time !== 'string') {
			throw new Error(`Failed to parse time '${unknownObject.time}' to Date.`);
		}
		const time = new Date(unknownObject.time);

		if (time.toString() === 'Invalid Date') {
			throw new Error(`Failed to parse time '${unknownObject.time}' to Date.`);
		}

		if (typeof unknownObject.datacontenttype !== 'string') {
			throw new Error(
				`Failed to parse dataContentType '${unknownObject.datacontenttype}' to string.`,
			);
		}
		if (typeof unknownObject.predecessorhash !== 'string') {
			throw new Error(
				`Failed to parse predecessorHash '${unknownObject.predecessorhash}' to string.`,
			);
		}

		return new EventContext(
			unknownObject.source,
			unknownObject.subject,
			unknownObject.type,
			unknownObject.specversion,
			unknownObject.id,
			time,
			unknownObject.datacontenttype,
			unknownObject.predecessorhash,
		);
	}

	public toJSON(): Record<string, unknown> {
		return {
			specversion: this.specVersion,
			id: this.id,
			time: this.time.toISOString(),
			source: this.source,
			subject: this.subject,
			type: this.type,
			datacontenttype: this.dataContentType,
			predecessorhash: this.predecessorHash,
		};
	}

	public toString(): string {
		return JSON.stringify(this);
	}
}

export { EventContext };
