import type { UnknownObject } from './UnknownObject.js';

const isObject = (value: unknown): value is UnknownObject => {
	return typeof value === 'object' && !Array.isArray(value) && value !== null;
};

export { isObject };
