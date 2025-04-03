import type { UnknownObject } from '../util/UnknownObject.js';

interface Item {
	type: 'item';
	payload: {
		event: UnknownObject;
		hash: string;
	};
}

export type { Item };
