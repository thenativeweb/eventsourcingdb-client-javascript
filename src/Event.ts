import crypto from 'node:crypto';

class Event {
	specversion: string;
	id: string;
	time: Date;
	#timeFromServer: string;
	source: string;
	subject: string;
	type: string;
	datacontenttype: string;
	data: Record<string, unknown>;
	hash: string;
	predecessorhash: string;
	traceparent?: string;
	tracestate?: string;
	signature: string | null;

	constructor({
		specversion,
		id,
		time,
		timeFromServer,
		source,
		subject,
		type,
		datacontenttype,
		data,
		hash,
		predecessorhash,
		traceparent,
		tracestate,
		signature,
	}: {
		specversion: string;
		id: string;
		time: Date;
		timeFromServer: string;
		source: string;
		subject: string;
		type: string;
		datacontenttype: string;
		data: Record<string, unknown>;
		hash: string;
		predecessorhash: string;
		traceparent?: string;
		tracestate?: string;
		signature: string | null;
	}) {
		this.specversion = specversion;
		this.id = id;
		this.time = time;
		this.#timeFromServer = timeFromServer;
		this.source = source;
		this.subject = subject;
		this.type = type;
		this.datacontenttype = datacontenttype;
		this.data = data;
		this.hash = hash;
		this.predecessorhash = predecessorhash;
		this.traceparent = traceparent;
		this.tracestate = tracestate;
		this.signature = signature;
	}

	verifyHash(): void {
		const metadata = `${this.specversion}|${this.id}|${this.predecessorhash}|${this.#timeFromServer}|${this.source}|${this.subject}|${this.type}|${this.datacontenttype}`;

		const metadataHash = crypto.createHash('sha256').update(metadata).digest('hex');
		const dataHash = crypto.createHash('sha256').update(JSON.stringify(this.data)).digest('hex');

		const finalHash = crypto
			.createHash('sha256')
			.update(`${metadataHash}${dataHash}`)
			.digest('hex');

		if (finalHash !== this.hash) {
			throw new Error('Failed to verify hash.');
		}
	}
}

export { Event };
