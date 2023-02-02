import { validateSubject } from '../../event/validateSubject';
import { validateType } from '../../event/validateType';
import { ValidationError } from '../../util/error/ValidationError';
import { wrapError } from '../../util/error/wrapError';
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
			'ObserveEventOptions are invalid: lowerBoundId must be a positive integer.',
		);
	}

	if (options.lowerBoundId !== undefined && options.fromLatestEvent !== undefined) {
		throw new ValidationError(
			'ObserveEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.',
		);
	}

	const { fromLatestEvent } = options;
	if (fromLatestEvent !== undefined) {
		wrapError(
			() => {
				validateSubject(fromLatestEvent.subject);
				validateType(fromLatestEvent.type);
			},
			(error) => {
				throw new ValidationError(
					`ObserveEventsOptions are invalid: Failed to validate 'fromLatestEvent': ${error.message}`,
				);
			},
		);
	}
};

export { ObserveEventsOptions, ObserveFromLatestEvent, validateObserveEventsOptions };
