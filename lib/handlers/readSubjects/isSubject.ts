import { isObject } from '../../util/isObject';
import { Subject } from './Subject';

const isSubject = (message: unknown): message is Subject => {
	if (!isObject(message) || message.type !== 'subject') {
		return false;
	}

	const { payload } = message;

	return isObject(payload) && typeof payload.subject === 'string';
};

export { isSubject };
