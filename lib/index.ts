// biome-ignore lint/performance/noBarrelFile: This is the main entry point for the library.
export { CancelationError } from './util/error/CancelationError.js';
export { Client } from './Client.js';
export type { ClientConfiguration } from './ClientConfiguration.js';
export { Event } from './event/Event.js';
export { EventCandidate } from './event/EventCandidate.js';
export type { ReadSubjectsOptions } from './handlers/readSubjects/ReadSubjectsOptions.js';
export { Source } from './event/Source.js';
export type { StoreItem } from './handlers/StoreItem.js';
export type {
	ObserveEventsOptions,
	ObserveFromLatestEvent,
} from './handlers/observeEvents/ObserveEventsOptions.js';
export type { Precondition } from './handlers/writeEvents/Precondition.js';
export {
	isSubjectPristine,
	isSubjectOnEventId,
} from './handlers/writeEvents/Precondition.js';
export type {
	ReadEventsOptions,
	ReadFromLatestEvent,
} from './handlers/readEvents/ReadEventsOptions.js';
