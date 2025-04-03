interface EventCandidate {
	source: string;
	subject: string;
	type: string;
	data: Record<string, unknown>;
	traceparent?: string;
	tracestate?: string;
}

export type { EventCandidate };
