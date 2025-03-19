import { isObject } from '../util/isObject.js';
import type { Item } from './Item.js';

const isItem = (message: unknown): message is Item => {
	if (!isObject(message) || message.type !== 'item') {
		return false;
	}

	const { payload } = message;

	return isObject(payload) && isObject(payload.event) && typeof payload.hash === 'string';
};

export { isItem };
