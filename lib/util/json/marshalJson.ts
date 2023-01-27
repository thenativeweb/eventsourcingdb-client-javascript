import { UnknownObject } from '../UnknownObject';

const JsonUndefined = Symbol('undefined');
type Undefined = typeof JsonUndefined;

const newMarshalError = function (path: string, message: string): Error {
	return new Error(`Failed to marshal path '${path}': ${message}.`);
};

const getSymbolPropertyNames = function (obj: UnknownObject): string[] {
	return Object.getOwnPropertySymbols(obj).map((name) => name.toString());
};

const getUnenumerablePropertyNames = function (obj: UnknownObject): string[] {
	return Object.entries(Object.getOwnPropertyDescriptors(obj))
		.filter(([, description]) => !description.enumerable)
		.map(([name]) => name);
};

const getFunctionPropertyNames = function (obj: UnknownObject): string[] {
	return Object.entries(Object.getOwnPropertyDescriptors(obj))
		.filter(([, description]) => typeof description.value === 'function')
		.map(([name]) => name);
};

const isClassInstance = function (obj: UnknownObject): boolean {
	return obj.constructor !== Object;
};

const marshalJsonInternal = function (
	value: unknown,
	path: string,
	visitedValues: unknown[],
): string | Undefined {
	switch (typeof value) {
		case 'function':
			throw newMarshalError(path, "function can't be marshalled as JSON");
		case 'bigint':
			throw newMarshalError(path, "BigInt can't be marshalled as JSON");
		case 'symbol':
			throw newMarshalError(path, "Symbol can't be marshalled as JSON");
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

					for (const visitedValue of visitedValues) {
						if (child === visitedValue) {
							throw newMarshalError(path, `circular reference '${i}'`);
						}
					}

					let marshaledChild = marshalJsonInternal(child, `${path}.${i}`, [
						...visitedValues,
						value,
					]);

					if (marshaledChild === JsonUndefined) {
						marshaledChild = 'null';
					}

					parts.push(marshaledChild);
				}

				return `[${parts.join(',')}]`;
			}

			const isValueClassInstance = isClassInstance(value);
			const nonEnumerablePropertyNames = getUnenumerablePropertyNames(value);
			const hasValueUnenumerableProperties = nonEnumerablePropertyNames.length > 0;
			const functionPropertyNames = getFunctionPropertyNames(value);
			const hasValueFunctionProperties = functionPropertyNames.length > 0;
			const symbolPropertyNames = getSymbolPropertyNames(value);
			const hasSymbolPropertyNames = symbolPropertyNames.length > 0;
			const isValuePlainObject = !(
				isValueClassInstance ||
				hasValueUnenumerableProperties ||
				hasValueFunctionProperties ||
				hasSymbolPropertyNames
			);

			if (isValuePlainObject) {
				const parts: string[] = [];

				for (const [key, child] of Object.entries(value)) {
					for (const visitedValue of visitedValues) {
						if (child === visitedValue) {
							throw newMarshalError(path, `circular reference '${key}'`);
						}
					}

					const serializedChild = marshalJsonInternal(child, `${path}.${key}`, [
						...visitedValues,
						value,
					]);

					if (serializedChild === JsonUndefined) {
						continue;
					}

					parts.push(`"${key}":${serializedChild}`);
				}

				return `{${parts.join(',')}}`;
			}

			let plainObject: UnknownObject;
			try {
				plainObject = (value as { toJSON: () => UnknownObject }).toJSON();
			} catch {
				let errorMessages: string[] = [];

				if (isValueClassInstance) {
					errorMessages.push('the object is an instance of a class');
				}
				if (hasValueUnenumerableProperties) {
					errorMessages.push(
						`the object has non-enumerable properties (${nonEnumerablePropertyNames.join(', ')})`,
					);
				}
				if (hasValueFunctionProperties) {
					errorMessages.push(
						`the object has function properties (${functionPropertyNames.join(', ')})`,
					);
				}
				if (hasSymbolPropertyNames) {
					errorMessages.push(
						`the object has Symbol properties (${symbolPropertyNames.join(', ')})`,
					);
				}

				throw newMarshalError(
					path,
					`Non-plain objects require a toJSON() method to be defined in their prototype chain, see https://javascript.info/json. The object is considered non-plain, because of these reasons: ${errorMessages.join(
						', ',
					)}`,
				);
			}

			return marshalJsonInternal(plainObject, path, [...visitedValues, value]);
	}
};

const marshalJson = function (value: unknown): string | undefined {
	const marshaledValue = marshalJsonInternal(value, '[root element]', []);

	if (marshaledValue === JsonUndefined) {
		return undefined;
	}

	return marshaledValue;
};

export { marshalJson };
