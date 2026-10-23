import type { Precondition } from './Precondition.js';
import type { PreconditionOptions } from './PreconditionOptions.js';
import { withPreconditionOptions } from './withPreconditionOptions.js';

const isSubjectPopulated = (subject: string, options?: PreconditionOptions): Precondition => ({
	type: 'isSubjectPopulated',
	payload: { subject, ...withPreconditionOptions(options) },
});

export { isSubjectPopulated };
