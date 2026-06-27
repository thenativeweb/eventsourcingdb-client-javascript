import type { Precondition } from './Precondition.js';

const isSubjectPristine = (subject: string): Precondition => ({
	type: 'isSubjectPristine',
	payload: { subject },
});

export { isSubjectPristine };
