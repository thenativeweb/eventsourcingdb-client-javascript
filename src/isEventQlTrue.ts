import type { Precondition } from './Precondition.js';

const isEventQlTrue = (query: string): Precondition => {
	return {
		type: 'isEventQLTrue',
		payload: { query },
	};
};

export { isEventQlTrue };
