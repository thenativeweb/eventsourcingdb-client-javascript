import type { Precondition } from './Precondition.js';
import type { PreconditionOptions } from './PreconditionOptions.js';
import { withPreconditionOptions } from './withPreconditionOptions.js';

const isSubjectPristine = (subject: string, options?: PreconditionOptions): Precondition => ({
	type: 'isSubjectPristine',
	payload: { subject, ...withPreconditionOptions(options) },
});

export { isSubjectPristine };
