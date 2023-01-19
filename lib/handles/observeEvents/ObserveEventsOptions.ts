interface ObserveEventsOptions {
	recursive: boolean;
	lowerBoundId?: number;
	fromLatestEvent?: ObserveFromLatestEvent;
}

interface ObserveFromLatestEvent {
	subject: string;
	type: string;
	ifEventIsMissing: 'read-nothing' | 'wait-for-event';
}

export { ObserveEventsOptions };
