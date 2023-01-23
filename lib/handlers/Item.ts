import { UnknownObject } from '../util/UnknownObject';

interface Item {
	type: 'item';
	payload: {
		event: UnknownObject;
		hash: string;
	};
}

export { Item };
