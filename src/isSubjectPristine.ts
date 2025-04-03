import type { Precondition } from './Precondition.js';

const isSubjectPristine = (subject: string): Precondition => {
	return {
		type: 'isSubjectPristine',
		payload: { subject },
	};
};

export { isSubjectPristine };
