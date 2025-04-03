import type { Precondition } from './Precondition.js';

const isSubjectOnEventId = (subject: string, eventId: string): Precondition => {
	return {
		type: 'isSubjectOnEventId',
		payload: { subject, eventId },
	};
};

export { isSubjectOnEventId };
