import { assert } from 'assertthat';
import { validateSubject } from '../../../lib/event/validateSubject';

suite('validateSubject()', () => {
	test('returns without throwing on a valid subject.', () => {
		assert
			.that(() => {
				validateSubject('/this/is/valid');
			})
			.is.not.throwing();
	});

	test('contains the invalid subject in the error message in case of throwing.', () => {
		assert
			.that(() => {
				validateSubject('invalidExampleSubject');
			})
			.is.throwing((error) => error.message.includes('invalidExampleSubject'));
	});

	test('is throwing if the subject is not an absolute slash separated path.', () => {
		assert
			.that(() => {
				validateSubject('invalidExampleSubject');
			})
			.is.throwing();
	});

	test('is throwing if the subject is a relative path.', () => {
		assert
			.that(() => {
				validateSubject('this/is/invalid');
			})
			.is.throwing();
	});

	test('is throwing if the subject has invalid characters.', () => {
		assert
			.that(() => {
				validateSubject('/user/günter/registered');
			})
			.is.throwing();
	});
});
