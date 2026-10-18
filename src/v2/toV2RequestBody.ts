import type { Bound } from '../Bound.js';
import type { EventCandidate } from '../EventCandidate.js';
import type { ObserveEventsOptions } from '../ObserveEventsOptions.js';
import type { Precondition } from '../Precondition.js';
import type { ReadEventsOptions } from '../ReadEventsOptions.js';

// The v2 API refuses unknown fields and null, so these build the bodies of its
// requests from the fields it knows, and leave out the ones without a value.
// JSON.stringify leaves out a field whose value is undefined.

const toBound = (bound: Bound | undefined): Record<string, unknown> | undefined =>
	bound ? { id: bound.id, type: bound.type } : undefined;

const toFromLatestEvent = (
	fromLatestEvent: ReadEventsOptions['fromLatestEvent'] | ObserveEventsOptions['fromLatestEvent'],
): Record<string, unknown> | undefined =>
	fromLatestEvent
		? {
				subject: fromLatestEvent.subject,
				type: fromLatestEvent.type,
				ifEventIsMissing: fromLatestEvent.ifEventIsMissing,
			}
		: undefined;

const toWriteEventsBody = (
	events: EventCandidate[],
	preconditions: Precondition[],
): Record<string, unknown> => ({
	events: events.map(event => ({
		source: event.source,
		subject: event.subject,
		type: event.type,
		data: event.data,
		traceparent: event.traceparent ?? undefined,
		tracestate: event.tracestate ?? undefined,
	})),
	preconditions:
		preconditions.length === 0
			? undefined
			: preconditions.map(precondition => ({
					type: precondition.type,
					payload: precondition.payload,
				})),
});

const toReadEventsBody = (
	subject: string,
	options: ReadEventsOptions,
): Record<string, unknown> => ({
	subject,
	options: {
		recursive: options.recursive,
		order: options.order ?? undefined,
		lowerBound: toBound(options.lowerBound),
		upperBound: toBound(options.upperBound),
		fromLatestEvent: toFromLatestEvent(options.fromLatestEvent),
	},
});

const toObserveEventsBody = (
	subject: string,
	options: ObserveEventsOptions,
): Record<string, unknown> => ({
	subject,
	options: {
		recursive: options.recursive,
		lowerBound: toBound(options.lowerBound),
		fromLatestEvent: toFromLatestEvent(options.fromLatestEvent),
	},
});

export { toObserveEventsBody, toReadEventsBody, toWriteEventsBody };
