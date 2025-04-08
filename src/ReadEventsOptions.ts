import type { Bound } from './Bound.js';

type Order = 'chronological' | 'antichronological';

type ReadIfEventIsMissing = 'read-nothing' | 'read-everything';

interface ReadFromLatestEvent {
	subject: string;
	type: string;
	ifEventIsMissing: ReadIfEventIsMissing;
}

interface ReadEventsOptions {
	recursive: boolean;
	order?: Order;
	lowerBound?: Bound;
	upperBound?: Bound;
	fromLatestEvent?: ReadFromLatestEvent;
}

export type { Order, ReadIfEventIsMissing, ReadFromLatestEvent, ReadEventsOptions };
