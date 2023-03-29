import { isObject } from '../util/isObject';
import { Heartbeat } from './Heartbeat';

const isHeartbeat = function (message: unknown): message is Heartbeat {
	return isObject(message) && message.type === 'heartbeat';
};

export { isHeartbeat };
