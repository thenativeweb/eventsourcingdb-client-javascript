import type { Precondition } from './Precondition.js';

const isEventQlQueryTrue = (query: string): Precondition => ({
	type: 'isEventQlQueryTrue',
	payload: { query },
});

export { isEventQlQueryTrue };
