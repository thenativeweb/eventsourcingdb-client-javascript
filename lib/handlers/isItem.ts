import { isObject } from '../util/isObject';
import { Item } from './Item';

const isItem = (message: unknown): message is Item => {
	if (!isObject(message) || message.type !== 'item') {
		return false;
	}

	const { payload } = message;

	return isObject(payload) && isObject(payload.event) && typeof payload.hash === 'string';
};

export { isItem };
