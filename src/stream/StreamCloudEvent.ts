interface StreamCloudEvent {
	type: 'event';
	payload: {
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
	};
}

export type { StreamCloudEvent };
