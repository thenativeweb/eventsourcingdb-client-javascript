import { isObject } from '../util/isObject.js';
import type { Heartbeat } from './Heartbeat.js';

const isHeartbeat = (message: unknown): message is Heartbeat => {
	return isObject(message) && message.type === 'heartbeat';
};

export { isHeartbeat };
