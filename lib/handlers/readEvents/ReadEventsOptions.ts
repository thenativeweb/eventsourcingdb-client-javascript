import { validateSubject } from '../../event/validateSubject';
import { validateType } from '../../event/validateType';
import { ValidationError } from '../../util/error/ValidationError';
import { wrapError } from '../../util/error/wrapError';
import { isPositiveInteger } from '../../util/isPositiveInteger';

interface ReadEventsOptions {
	recursive: boolean;
	chronological?: boolean;
	lowerBoundId?: string;
	upperBoundId?: string;
	fromLatestEvent?: ReadFromLatestEvent;
}

interface ReadFromLatestEvent {
	subject: string;
	type: string;
	ifEventIsMissing: 'read-nothing' | 'read-everything';
}

const validateReadEventsOptions = function (options: ReadEventsOptions): void {
	if (options.lowerBoundId !== undefined && !isPositiveInteger(options.lowerBoundId)) {
		throw new ValidationError(
			'ReadEventsOptions are invalid: lowerBoundId must be a positive integer.',
		);
	}
	if (options.upperBoundId !== undefined && !isPositiveInteger(options.upperBoundId)) {
		throw new ValidationError(
			'ReadEventsOptions are invalid: upperBoundId must be a positive integer.',
		);
	}

	if (options.fromLatestEvent !== undefined) {
		if (options.lowerBoundId !== undefined) {
			throw new ValidationError(
				'ReadEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.',
			);
		}

		const { fromLatestEvent } = options;
		wrapError(
			() => {
				validateSubject(fromLatestEvent.subject);
				validateType(fromLatestEvent.type);
			},
			(error) => {
				throw new ValidationError(
					`ReadEventsOptions are invalid: Failed to validate 'fromLatestEvent': ${error.message}`,
				);
			},
		);
	}
};

export { ReadEventsOptions, ReadFromLatestEvent, validateReadEventsOptions };
