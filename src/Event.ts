import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { HashVerificationFailedError } from './HashVerificationFailedError.js';
import { SignatureVerificationFailedError } from './SignatureVerificationFailedError.js';
import { UnsupportedHashVersionError } from './UnsupportedHashVersionError.js';

// A hash of version 2 starts with this prefix. A hash without a prefix is of
// version 1, which predates the prefix.
const hashVersion2Prefix = 'esdb:hash:v2:';
const hashVersionRegex = /^esdb:hash:(?<version>[^:]*):/u;

// The input of a hash of version 2 writes a field that the event does not
// have like this.
const missingField = '-';

// A signature starts with this prefix, followed by its bytes in hex.
const signaturePrefix = 'esdb:signature:v1:';

const getSha256 = (input: string): string =>
	crypto.createHash('sha256').update(input).digest('hex');

const getSignatureBytes = (signature: string): Buffer => {
	if (!signature.startsWith(signaturePrefix)) {
		throw new Error(`Signature must start with '${signaturePrefix}'`);
	}

	return Buffer.from(signature.slice(signaturePrefix.length), 'hex');
};

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
	#dataFromServer: string;
	public hash: string;
	public predecessorhash: string;
	public traceparent?: string;
	public tracestate?: string;
	public signature: string | null;

	// biome-ignore lint/nursery/noExcessiveStatementsPerFunction: The constructor assigns each field of the event, one statement per field.
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
		dataFromServer,
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
		dataFromServer: string;
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
		this.#dataFromServer = dataFromServer;
		this.hash = hash;
		this.predecessorhash = predecessorhash;
		this.traceparent = traceparent;
		this.tracestate = tracestate;
		this.signature = signature;
	}

	#computeHashOfVersion1(): string {
		const metadata = `${this.specversion}|${this.id}|${this.predecessorhash}|${this.#timeFromServer}|${this.source}|${this.subject}|${this.type}|${this.datacontenttype}`;

		const metadataHash = getSha256(metadata);
		const dataHash = getSha256(this.#dataFromServer);

		return getSha256(`${metadataHash}${dataHash}`);
	}

	#computeHashOfVersion2(): string {
		const input = [
			hashVersion2Prefix,
			this.specversion,
			this.id,
			this.predecessorhash,
			this.#timeFromServer,
			this.source,
			this.subject,
			this.type,
			this.datacontenttype,
			this.traceparent ?? missingField,
			this.tracestate ?? missingField,
			this.#dataFromServer,
		].join('\n');

		return `${hashVersion2Prefix}${getSha256(input)}`;
	}

	// An event keeps the version of the hash it was written with, so the hash
	// is computed in the version it names.
	#computeHash(): string {
		const version = hashVersionRegex.exec(this.hash)?.groups?.version;

		if (version === undefined) {
			return this.#computeHashOfVersion1();
		}
		if (`esdb:hash:${version}:` === hashVersion2Prefix) {
			return this.#computeHashOfVersion2();
		}

		throw new UnsupportedHashVersionError(version);
	}

	public verifyHash(): void {
		if (this.#computeHash() !== this.hash) {
			throw new HashVerificationFailedError();
		}

		// The hash covers the data as the server sent it, so data that has been
		// changed since would go unnoticed without comparing the two.
		if (!isDeepStrictEqual(this.data, JSON.parse(this.#dataFromServer))) {
			throw new HashVerificationFailedError();
		}
	}

	public verifySignature(verificationKey: crypto.KeyObject): void {
		if (this.signature === null) {
			throw new Error('Signature must not be null.');
		}

		this.verifyHash();

		const signatureBytes = getSignatureBytes(this.signature);
		const hashBytes = Buffer.from(this.hash, 'utf8');

		const isSignatureValid = crypto.verify(null, hashBytes, verificationKey, signatureBytes);
		if (!isSignatureValid) {
			throw new SignatureVerificationFailedError();
		}
	}
}

export { Event };
