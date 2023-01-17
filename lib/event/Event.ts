import { isObject } from '../util/isObject';
import { validateSubject } from './validateSubject';
import { validateType } from './validateType';

class Event {
  /* eslint-disable @typescript-eslint/explicit-member-accessibility */
  readonly #data: Record<string, unknown>;

  readonly #source: string;

  readonly #subject: string;

  readonly #type: string;

  readonly #specVersion: string;

  readonly #id: string;

  readonly #time: Date;

  readonly #dataContentType: string;

  readonly #predecessorHash: string;
  /* eslint-enable @typescript-eslint/explicit-member-accessibility */

  private constructor (
    data: Record<string, unknown>,
    source: string,
    subject: string,
    type: string,
    specVersion: string,
    id: string,
    time: Date,
    dataContentType: string,
    predecessorHash: string
  ) {
    this.#data = data;
    this.#source = source;
    this.#subject = subject;
    this.#type = type;
    this.#specVersion = specVersion;
    this.#id = id;
    this.#time = time;
    this.#dataContentType = dataContentType;
    this.#predecessorHash = predecessorHash;
  }

  public get data (): Record<string, unknown> {
    return this.#data;
  }

  public get source (): string {
    return this.#source;
  }

  public get subject (): string {
    return this.#subject;
  }

  public get type (): string {
    return this.#type;
  }

  public get specVersion (): string {
    return this.#specVersion;
  }

  public get id (): string {
    return this.#id;
  }

  public get time (): Date {
    return this.#time;
  }

  public get dataContentType (): string {
    return this.#dataContentType;
  }

  public get predecessorHash (): string {
    return this.#predecessorHash;
  }

  public static parseFromJson (rawEventJson: string): Event {
    const parsedJson = JSON.parse(rawEventJson);

    if (!isObject(parsedJson.data)) {
      throw new Error(`Cannot parse data: ${parsedJson.data} to object.`);
    }
    if (typeof parsedJson.source !== 'string') {
      throw new Error(`Cannot parse source: ${parsedJson.source} to string.`);
    }
    if (typeof parsedJson.subject !== 'string') {
      throw new Error(`Cannot parse subject: ${parsedJson.subject} to string.`);
    }
    validateSubject(parsedJson.subject);
    if (typeof parsedJson.type !== 'string') {
      throw new Error(`Cannot parse type: ${parsedJson.type} to string.`);
    }
    validateType(parsedJson.type);
    if (typeof parsedJson.specversion !== 'string') {
      throw new Error(`Cannot parse specVersion: ${parsedJson.specversion} to string.`);
    }
    if (typeof parsedJson.id !== 'string') {
      throw new Error(`Cannot parse id: ${parsedJson.id} to string.`);
    }
    if (typeof parsedJson.datacontenttype !== 'string') {
      throw new Error(`Cannot parse dataContentType: ${parsedJson.datacontenttype} to string.`);
    }
    if (typeof parsedJson.predecessorhash !== 'string') {
      throw new Error(`Cannot parse predecessorHash: ${parsedJson.predecessorhash} to string.`);
    }

    return new Event(
      parsedJson.data,
      parsedJson.source,
      parsedJson.subject,
      parsedJson.type,
      parsedJson.specversion,
      parsedJson.id,
      new Date(),
      parsedJson.datacontenttype,
      parsedJson.predecessorhash
    );
  }
}

export { Event };
