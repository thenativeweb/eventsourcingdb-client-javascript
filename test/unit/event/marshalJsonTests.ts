import { assert } from 'assertthat';
import { marshalJson } from '../../../lib/event/marshalJson';
import { UnknownObject } from '../../../lib/util/UnknownObject';

suite('marshalJson', (): void => {
	test('marshals a number.', async (): Promise<void> => {
		const numbersToTest = [0, 1, NaN, -2, 43];

		for (const number of numbersToTest) {
			assert.that(marshalJson(number)).is.equalTo(JSON.stringify(number));
		}
	});

	test('marshals a string.', async (): Promise<void> => {
		const stringsToTest = ['', 'äöüpäö', '\n\t', 'gandalf1', 'kadse 😸'];

		for (const string of stringsToTest) {
			assert.that(marshalJson(string)).is.equalTo(JSON.stringify(string));
		}
	});

	test('marshals a boolean.', async (): Promise<void> => {
		assert.that(marshalJson(true)).is.equalTo(JSON.stringify(true));
		assert.that(marshalJson(false)).is.equalTo(JSON.stringify(false));
	});

	test('marshals null.', async (): Promise<void> => {
		assert.that(marshalJson(null)).is.equalTo(JSON.stringify(null));
	});

	test('marshals undefined.', async (): Promise<void> => {
		assert.that(marshalJson(undefined)).is.equalTo(JSON.stringify(undefined));
	});

	test('throws an error when trying to marshal a function.', async (): Promise<void> => {
		assert
			.that(() => {
				marshalJson(() => {});
			})
			.is.throwing(
				"Failed to marshal path '[root element]': function can't be marshalled as JSON.",
			);
		assert
			.that(() => {
				marshalJson(function () {});
			})
			.is.throwing(
				"Failed to marshal path '[root element]': function can't be marshalled as JSON.",
			);
	});

	test('throws an error when trying to marshal a BigInt.', async (): Promise<void> => {
		assert
			.that(() => {
				marshalJson(1236969696969696969696969696969696969696969696969696969696969696969n);
			})
			.is.throwing("Failed to marshal path '[root element]': BigInt can't be marshalled as JSON.");
		assert
			.that(() => {
				marshalJson(
					BigInt(
						123444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444443,
					),
				);
			})
			.is.throwing("Failed to marshal path '[root element]': BigInt can't be marshalled as JSON.");
	});

	test('throws an error when trying to marshal a Symbol.', async (): Promise<void> => {
		assert
			.that(() => {
				marshalJson(Symbol());
			})
			.is.throwing("Failed to marshal path '[root element]': Symbol can't be marshalled as JSON.");
	});

	suite('when used with arrays', (): void => {
		test('marshals arrays.', async (): Promise<void> => {
			const arraysToTest = [[], [1, 2, 3], ['foo', 'bar'], [null, true, 1, 'bar']];

			for (const array of arraysToTest) {
				assert.that(marshalJson(array)).is.equalTo(JSON.stringify(array));
			}
		});

		test('converts undefined array elements to null.', async (): Promise<void> => {
			const testArray = [1, 2, undefined, 4, undefined];
			assert.that(marshalJson(testArray)).is.equalTo(JSON.stringify(testArray));
			assert.that(marshalJson(testArray)).is.equalTo('[1,2,null,4,null]');
		});

		test('converts empty array elements to null.', async (): Promise<void> => {
			// rome-ignore lint/suspicious/noSparseArray: we want to explicitly test the sparse array case.
			const testArray = [1, 2, , 4];
			assert.that(marshalJson(testArray)).is.equalTo(JSON.stringify(testArray));
			assert.that(marshalJson(testArray)).is.equalTo('[1,2,null,4]');
		});
	});

	suite('when used with objects', (): void => {
		test('marshals objects.', async (): Promise<void> => {
			const objectsToTest = [{}, { 1: 2, 3: 4 }, { jamba: 'script' }];

			for (const object of objectsToTest) {
				assert.that(marshalJson(object)).is.equalTo(JSON.stringify(object));
			}
		});

		test('throws an error if the object has Symbol properties.', async (): Promise<void> => {
			assert
				.that(() => {
					marshalJson({ [Symbol('fail')]: 42 });
				})
				.is.throwing(
					"Failed to marshal path '[root element]': Non-plain objects require a toJSON() method to be defined in their prototype chain, see https://javascript.info/json. The object is considered non-plain, because of these reasons: the object has Symbol properties (Symbol(fail)).",
				);
			assert
				.that(() => {
					marshalJson({ [Symbol('fail')]: 42, [Symbol('anotherFail')]: 42 });
				})
				.is.throwing(
					"Failed to marshal path '[root element]': Non-plain objects require a toJSON() method to be defined in their prototype chain, see https://javascript.info/json. The object is considered non-plain, because of these reasons: the object has Symbol properties (Symbol(fail), Symbol(anotherFail)).",
				);
		});

		test('throws an error if the object has function properties.', async (): Promise<void> => {
			assert
				.that(() => {
					marshalJson({ failFn: () => {} });
				})
				.is.throwing(
					"Failed to marshal path '[root element]': Non-plain objects require a toJSON() method to be defined in their prototype chain, see https://javascript.info/json. The object is considered non-plain, because of these reasons: the object has function properties (failFn).",
				);
			assert
				.that(() => {
					marshalJson({ failFn: () => {}, anotherFailFn: () => {} });
				})
				.is.throwing(
					"Failed to marshal path '[root element]': Non-plain objects require a toJSON() method to be defined in their prototype chain, see https://javascript.info/json. The object is considered non-plain, because of these reasons: the object has function properties (failFn, anotherFailFn).",
				);
		});

		test('throws an error if the object has non-enumerable properties.', async (): Promise<void> => {
			const firstBrokenInput = {};
			Object.defineProperty(firstBrokenInput, 'fail', { value: 42, enumerable: false });
			assert
				.that(() => {
					marshalJson(firstBrokenInput);
				})
				.is.throwing(
					"Failed to marshal path '[root element]': Non-plain objects require a toJSON() method to be defined in their prototype chain, see https://javascript.info/json. The object is considered non-plain, because of these reasons: the object has non-enumerable properties (fail).",
				);

			const secondBrokenInput = {};
			Object.defineProperty(secondBrokenInput, 'fail', { value: 42, enumerable: false });
			Object.defineProperty(secondBrokenInput, 'anotherFail', { value: 42, enumerable: false });
			assert
				.that(() => {
					marshalJson(secondBrokenInput);
				})
				.is.throwing(
					"Failed to marshal path '[root element]': Non-plain objects require a toJSON() method to be defined in their prototype chain, see https://javascript.info/json. The object is considered non-plain, because of these reasons: the object has non-enumerable properties (fail, anotherFail).",
				);
		});
	});

	suite('complex cases', (): void => {
		test('marshals nested structures.', async (): Promise<void> => {
			const structuresToTest: unknown[] = [
				// rome-ignore lint/suspicious/noSparseArray: we want to explicitly test the sparse array case.
				{ a: { b: { c: [1, 2, ,], d: 'foofoo' } } },
				[1, 2, { b: 3, c: [{ a: { b: [null, undefined] } }], x: [true, false, 123] }],
			];

			for (const structure of structuresToTest) {
				assert.that(marshalJson(structure)).is.equalTo(JSON.stringify(structure));
			}
		});

		test('finds and reports errors in nested structures.', async (): Promise<void> => {
			assert
				.that(() => {
					marshalJson({ a: { b: { c: [1, 2, { d: 123n }] } } });
				})
				.is.throwing(
					"Failed to marshal path '[root element].a.b.c.2.d': BigInt can't be marshalled as JSON.",
				);
		});

		test('finds and reports circular references in objects.', async (): Promise<void> => {
			const a: UnknownObject = {};
			const b: UnknownObject = {};

			a.b = b;
			b.a = a;

			assert
				.that(() => {
					marshalJson(a);
				})
				.is.throwing("Failed to marshal path '[root element].b': circular reference 'a'.");
		});

		test('finds and reports circular references in arrays.', async (): Promise<void> => {
			const a: unknown[] = [];
			const b: unknown[] = [];

			a[0] = b;
			b[0] = a;

			assert
				.that(() => {
					marshalJson(a);
				})
				.is.throwing("Failed to marshal path '[root element].0': circular reference '0'.");
		});
	});
});
