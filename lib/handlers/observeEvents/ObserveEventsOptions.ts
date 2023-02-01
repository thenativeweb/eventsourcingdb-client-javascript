import { validateSubject } from '../../event/validateSubject';
import { validateType } from '../../event/validateType';
import { ValidationError } from '../../util/error/ValidationError';
import { isPositiveInteger } from '../../util/isPositiveInteger';

interface ObserveEventsOptions {
	recursive: boolean;
	lowerBoundId?: string;
	fromLatestEvent?: ObserveFromLatestEvent;
}

interface ObserveFromLatestEvent {
	subject: string;
	type: string;
	ifEventIsMissing: 'read-nothing' | 'wait-for-event';
}

const validateObserveEventsOptions = function (options: ObserveEventsOptions): void {
	if (options.lowerBoundId !== undefined && !isPositiveInteger(options.lowerBoundId)) {
		throw new ValidationError(
			'ObserveEventOptions are invalid: lowerBoundId needs to be a positive integer.',
		);
	}

	if (options.lowerBoundId !== undefined && options.fromLatestEvent !== undefined) {
		throw new ValidationError(
			'ObserveEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.',
		);
	}

	if (options.fromLatestEvent !== undefined) {
		validateSubject(options.fromLatestEvent.subject);
		validateType(options.fromLatestEvent.type);
	}
};

export { ObserveEventsOptions, ObserveFromLatestEvent, validateObserveEventsOptions };
