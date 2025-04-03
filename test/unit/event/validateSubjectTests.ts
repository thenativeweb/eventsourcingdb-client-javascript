import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { validateSubject } from '../../../src/event/validateSubject.js';
import { ValidationError } from '../../../src/util/error/ValidationError.js';

suite('validateSubject', () => {
	test('returns without throwing on a valid subject.', () => {
		// Should not throw.
		validateSubject('/this/is/valid');
	});

	test('contains the invalid subject in the error message in case of throwing.', () => {
		assert.throws(
			() => {
				validateSubject('invalidExampleSubject');
			},
			error => {
				assert.ok(error instanceof ValidationError);
				assert.ok(error.message.includes('invalidExampleSubject'));
				return true;
			},
		);
	});

	test('throws if the subject is not an absolute slash separated path.', () => {
		const subject = 'invalidExampleSubject';
		assert.throws(
			() => {
				validateSubject(subject);
			},
			error => {
				assert.ok(error instanceof ValidationError);
				assert.equal(
					`Failed to validate subject: '${subject}' must be an absolute, slash-separated path.`,
					error.message,
				);
				return true;
			},
		);
	});

	test('throws if the subject is a relative path.', () => {
		const subject = 'this/is/invalid';
		assert.throws(
			() => {
				validateSubject(subject);
			},
			error => {
				assert.ok(error instanceof ValidationError);
				assert.equal(
					`Failed to validate subject: '${subject}' must be an absolute, slash-separated path.`,
					error.message,
				);
				return true;
			},
		);
	});

	test('throws if the subject has invalid characters.', () => {
		const subject = '/user/günter/registered';
		assert.throws(
			() => {
				validateSubject(subject);
			},
			error => {
				assert.ok(error instanceof ValidationError);
				assert.equal(
					`Failed to validate subject: '${subject}' must be an absolute, slash-separated path.`,
					error.message,
				);
				return true;
			},
		);
	});
});
