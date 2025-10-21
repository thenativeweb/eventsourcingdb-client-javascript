import type { Precondition } from './Precondition.js';

const isSubjectPopulated = (subject: string): Precondition => {
	return {
		type: 'isSubjectPopulated',
		payload: { subject },
	};
};

export { isSubjectPopulated };
