import crypto from 'node:crypto';

class Event {
	public specversion: string;
	public id: string;
	public time: Date;
	#timeFromServer: string;
	public source: string;
	public subject: string;
	public type: string;
	public datacontenttype: string;
	public data: Record<string, unknown>;
	public hash: string;
	public predecessorhash: string;
	public traceparent?: string;
	public tracestate?: string;
	public signature: string | null;

	public constructor({
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

	public verifyHash(): void {
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

	public verifySignature(verificationKey: crypto.KeyObject): void {
		if (this.signature === null) {
			throw new Error('Signature must not be null.');
		}

		this.verifyHash();

		const signaturePrefix = 'esdb:signature:v1:';

		if (!this.signature.startsWith(signaturePrefix)) {
			throw new Error(`Signature must start with '${signaturePrefix}'`);
		}

		const signature = this.signature.slice(signaturePrefix.length);
		const signatureBytes = Buffer.from(signature, 'hex');
		const hashBytes = Buffer.from(this.hash, 'utf8');

		const isSignatureValid = crypto.verify(null, hashBytes, verificationKey, signatureBytes);
		if (!isSignatureValid) {
			throw new Error('Signature verification failed.');
		}
	}
}

export { Event };
