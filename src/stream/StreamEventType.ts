interface StreamEventType {
	type: 'eventType';
	payload: {
		eventType: string;
		isPhantom: boolean;
		schema?: string;
	};
}

export type { StreamEventType };
