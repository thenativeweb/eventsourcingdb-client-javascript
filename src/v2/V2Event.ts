// An event as the v2 API sends it, which sends an absent trace context as null.
interface V2Event {
	specversion: string;
	id: string;
	time: string;
	source: string;
	subject: string;
	type: string;
	datacontenttype: string;
	data: Record<string, unknown>;
	hash: string;
	predecessorhash: string;
	traceparent: string | null;
	tracestate: string | null;
	signature: string | null;
}

export type { V2Event };
