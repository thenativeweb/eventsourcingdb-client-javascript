interface StreamEventType {
	type: 'eventType';
	payload: {
		eventType: string;
		isPhantom: boolean;
		schema?: Record<string, unknown>;
	};
}

export type { StreamEventType };
