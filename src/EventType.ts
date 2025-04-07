interface EventType {
	eventType: string;
	isPhantom: boolean;
	schema?: Record<string, unknown>;
}

export type { EventType };
