import { assert } from 'assertthat';
import { validateType } from '../../../lib/event/validateType';
import { ValidationError } from '../../../lib/util/error/ValidationError';

suite('validateType()', () => {
	test('returns without throwing on a valid type.', async () => {
		assert
			.that(() => {
				validateType('com.example.exampleType');
			})
			.is.not.throwing();
	});

	test('contains the invalid type in the error message in case of throwing an error.', () => {
		assert
			.that(() => {
				validateType('invalidExampleType');
			})
			.is.throwing(
				(error) => error.message.includes('invalidExampleType') && error instanceof ValidationError,
			);
	});

	test('is throwing an error if the type is not a reverse domain name.', () => {
		assert
			.that(() => {
				validateType('invalidExampleType');
			})
			.is.throwing((error) => error instanceof ValidationError);
	});

	test("is throwing an error if the separator is not not a '.'.", () => {
		assert
			.that(() => {
				validateType('com:example:exampleType');
			})
			.is.throwing((error) => error instanceof ValidationError);
	});

	test('is throwing an error if the reverse domain has less than 3 segments.', () => {
		assert
			.that(() => {
				validateType('com.example');
			})
			.is.throwing((error) => error instanceof ValidationError);
	});

	test('is throwing an error if the type has invalid characters.', () => {
		assert
			.that(() => {
				validateType('com.example.apfel-günter.registered');
			})
			.is.throwing((error) => error instanceof ValidationError);
	});

	test('is throwing an error if the tld of the reverse domain has less than 1 character.', () => {
		assert
			.that(() => {
				validateType('a.example.exampleType');
			})
			.is.throwing((error) => error instanceof ValidationError);
	});
});
