import { Heartbeat } from './Heartbeat';
import { isObject } from '../util/isObject';

const isHeartbeat = function (message: unknown): message is Heartbeat {
	return isObject(message) && message.type === 'heartbeat';
};

export { isHeartbeat };
