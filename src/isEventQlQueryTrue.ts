import type { Precondition } from './Precondition.js';

const isEventQlQueryTrue = (query: string): Precondition => {
	return {
		type: 'isEventQlQueryTrue',
		payload: { query },
	};
};

export { isEventQlQueryTrue };
