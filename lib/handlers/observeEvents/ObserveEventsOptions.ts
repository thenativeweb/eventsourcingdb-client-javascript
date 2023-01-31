import { validateSubject } from '../../event/validateSubject';
import { validateType } from '../../event/validateType';
import { ValidationError } from '../../util/error/ValidationError';

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
	if (options.fromLatestEvent !== undefined) {
		if (options.lowerBoundId !== undefined) {
			throw new ValidationError(
				'ObserveEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.',
			);
		}

		validateSubject(options.fromLatestEvent.subject);
		validateType(options.fromLatestEvent.type);
	}
};

export { ObserveEventsOptions, ObserveFromLatestEvent, validateObserveEventsOptions };
