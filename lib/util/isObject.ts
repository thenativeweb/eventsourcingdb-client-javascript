import { UnknownObject } from './UnknownObject';

const isObject = function (value: unknown): value is UnknownObject {
	return typeof value === 'object' && !Array.isArray(value) && value !== null;
};

export { isObject };
