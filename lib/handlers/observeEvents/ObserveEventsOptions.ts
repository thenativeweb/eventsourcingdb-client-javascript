import { validateSubject } from '../../event/validateSubject';
import { validateType } from '../../event/validateType';
import { ValidationError } from '../../util/error/ValidationError';
import { wrapError } from '../../util/error/wrapError';
import { IsNonNegativeInteger } from '../../util/isNonNegativeInteger';

interface ObserveEventsOptions {
	recursive: boolean;
	lowerBoundId?: string;
	fromLatestEvent?: ObserveFromLatestEvent;
}

interface ObserveFromLatestEvent {
	subject: string;
	type: string;
	ifEventIsMissing: 'read-everything' | 'wait-for-event';
}

const validateObserveEventsOptions = (options: ObserveEventsOptions): void => {
	if (options.lowerBoundId !== undefined && !IsNonNegativeInteger(options.lowerBoundId)) {
		throw new ValidationError(
			'ObserveEventsOptions are invalid: lowerBoundId must be 0 or greater.',
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
			error => {
				throw new ValidationError(
					`ObserveEventsOptions are invalid: Failed to validate 'fromLatestEvent': ${error.message}`,
				);
			},
		);
	}
};

export { ObserveEventsOptions, ObserveFromLatestEvent, validateObserveEventsOptions };
