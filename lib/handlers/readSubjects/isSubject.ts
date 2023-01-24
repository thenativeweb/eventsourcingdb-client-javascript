import { Subject } from './Subject';
import { isObject } from '../../util/isObject';

const isSubject = function (message: unknown): message is Subject {
	if (!isObject(message) || message.type !== 'subject') {
		return false;
	}

	const { payload } = message;

	return isObject(payload) && typeof payload.subject === 'string';
};

export { isSubject };
