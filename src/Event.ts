interface Event {
	specversion: string;
	id: string;
	time: Date;
	source: string;
	subject: string;
	type: string;
	datacontenttype: string;
	data: Record<string, unknown>;
	hash: string;
	predecessorhash: string;
	traceparent?: string;
	tracestate?: string;
}

export type { Event };
