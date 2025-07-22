import type { Precondition } from './Precondition.js';

const isEventQlTrue = (query: string): Precondition => {
	return {
		type: 'isEventQlTrue',
		payload: { query },
	};
};

export { isEventQlTrue };
