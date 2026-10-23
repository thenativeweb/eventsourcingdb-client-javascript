import type { Precondition } from './Precondition.js';
import type { PreconditionOptions } from './PreconditionOptions.js';
import { withPreconditionOptions } from './withPreconditionOptions.js';

const isSubjectOnEventId = (
	subject: string,
	eventId: string,
	options?: PreconditionOptions,
): Precondition => ({
	type: 'isSubjectOnEventId',
	payload: { subject, eventId, ...withPreconditionOptions(options) },
});

export { isSubjectOnEventId };
