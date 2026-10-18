interface EventType {
	type: string;
	hasEvents: boolean;
	schema?: Record<string, unknown>;
}

export type { EventType };
