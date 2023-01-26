import { UnknownObject } from '../util/UnknownObject';

const JsonUndefined = Symbol('undefined');
type Undefined = typeof JsonUndefined;

const newUnmarshalError = function (path: string, message: string): Error {
	return new Error(`Failed to marshal ${path}: ${message}.`);
};

const isPlainObject = function (obj: UnknownObject): boolean {
	return obj.constructor === Object;
};

const marshalJsonInternal = function (value: unknown, path: string): string | Undefined {
	switch (typeof value) {
		case 'function':
			throw newUnmarshalError(path, "function can't be marshalled as JSON");
		case 'bigint':
			throw newUnmarshalError(path, "BigInt can't be marshalled as JSON");
		case 'symbol':
			throw newUnmarshalError(path, "Symbol can't be marshalled as JSON");
		case 'undefined':
			return JsonUndefined;
		case 'boolean':
		case 'number':
		case 'string':
			return JSON.stringify(value);
		case 'object':
			if (value === null) {
				return 'null';
			}
			if (Array.isArray(value)) {
				const parts: string[] = [];

				for (let i = 0; i < value.length; i++) {
					const child = value[i];
					let serializedChild = marshalJsonInternal(child, `${path}.${i}`);

					if (serializedChild === JsonUndefined) {
						serializedChild = 'null';
					}

					parts.push(serializedChild);
				}

				return `[${parts.join()}]`;
			}
			if (isPlainObject(value)) {
				const parts: string[] = [];

				for (const [key, child] of Object.entries(value)) {
					const serializedChild = marshalJsonInternal(child, `${path}.${key}`);

					if (serializedChild === JsonUndefined) {
						continue;
					}

					parts.push(`"${key}":${serializedChild}`);
				}

				return `{${parts.join()}}`;
			}

			let plainObject: UnknownObject;
			try {
				plainObject = (value as any).toJSON();
			} catch {
				throw newUnmarshalError(
					path,
					'objects that are class instances require a toJSON() method to be defined in their prototype chain, see https://javascript.info/json',
				);
			}

			return marshalJsonInternal(plainObject, path);
	}
};

const marshalJson = function (value: unknown): string | undefined {
	const marshalledValue = marshalJsonInternal(value, '');

	if (marshalledValue === JsonUndefined) {
		return undefined;
	}

	return marshalledValue;
};

export { marshalJson };
