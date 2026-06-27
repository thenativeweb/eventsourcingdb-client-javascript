import type { Precondition } from './Precondition.js';

const isSubjectPopulated = (subject: string): Precondition => ({
	type: 'isSubjectPopulated',
	payload: { subject },
});

export { isSubjectPopulated };
