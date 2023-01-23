import { validateSubject } from '../../event/validateSubject';
import { validateType } from '../../event/validateType';

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

const validateObserveEventsOptions = function (options: ObserveEventsOptions): void {
	if (options.fromLatestEvent !== undefined) {
		if (options.lowerBoundId !== undefined) {
			throw new Error(
				'ObserveEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.',
			);
		}

		validateSubject(options.fromLatestEvent.subject);
		validateType(options.fromLatestEvent.type);
	}
};

export { ObserveEventsOptions, ObserveFromLatestEvent, validateObserveEventsOptions };
