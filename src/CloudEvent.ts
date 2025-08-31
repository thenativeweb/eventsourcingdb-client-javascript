interface CloudEvent {
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
	traceparent?: string;
	tracestate?: string;
	signature: string | null;
}

export type { CloudEvent };
