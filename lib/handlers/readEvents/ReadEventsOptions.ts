import { validateSubject } from '../../event/validateSubject';
import { validateType } from '../../event/validateType';

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
	if (options.fromLatestEvent !== undefined) {
		if (options.lowerBoundId !== undefined) {
			throw new Error(
				'ReadEventsOptions are invalid: lowerBoundId and fromLatestEvent are mutually exclusive.',
			);
		}

		validateSubject(options.fromLatestEvent.subject);
		validateType(options.fromLatestEvent.type);
	}
};

export { ReadEventsOptions, ReadFromLatestEvent, validateReadEventsOptions };
