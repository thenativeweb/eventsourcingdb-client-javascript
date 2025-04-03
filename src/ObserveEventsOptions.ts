import type { Bound } from './Bound.js';

type ObserveIfEventIsMissing = 'read-everything' | 'wait-for-event';

interface ObserveFromLatestEvent {
	subject: string;
	type: string;
	ifEventIsMissing: ObserveIfEventIsMissing;
}

interface ObserveEventsOptions {
	recursive: boolean;
	lowerBound?: Bound;
	fromLatestEvent?: ObserveFromLatestEvent;
}

export type { ObserveIfEventIsMissing, ObserveFromLatestEvent, ObserveEventsOptions };
