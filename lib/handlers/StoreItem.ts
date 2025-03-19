import type { Event } from '../event/Event.js';

interface StoreItem {
	event: Event;
	hash: string;
}

export type { StoreItem };
