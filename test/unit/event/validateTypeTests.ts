import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { validateType } from '../../../src/event/validateType.js';
import { ValidationError } from '../../../src/util/error/ValidationError.js';

suite('validateType', () => {
	test('returns without throwing on a valid type.', () => {
		// Should not throw.
		validateType('com.example.exampleType');
	});

	test('contains the invalid type in the error message in case of throwing an error.', () => {
		const eventType = 'invalidExampleType';
		assert.throws(
			() => {
				validateType(eventType);
			},
			error => {
				assert.ok(error instanceof ValidationError);
				assert.equal(
					`Failed to validate type: '${eventType}' must be a reverse domain name.`,
					error.message,
				);
				return true;
			},
		);
	});

	test('throws an error if the type is not a reverse domain name.', () => {
		const eventType = 'invalidExampleType';
		assert.throws(
			() => {
				validateType(eventType);
			},
			error => {
				assert.ok(error instanceof ValidationError);
				assert.equal(
					`Failed to validate type: '${eventType}' must be a reverse domain name.`,
					error.message,
				);
				return true;
			},
		);
	});

	test("throws an error if the separator is not not a '.'.", () => {
		const eventType = 'com:example:exampleType';
		assert.throws(
			() => {
				validateType(eventType);
			},
			error => {
				assert.ok(error instanceof ValidationError);
				assert.equal(
					`Failed to validate type: '${eventType}' must be a reverse domain name.`,
					error.message,
				);
				return true;
			},
		);
	});

	test('throws an error if the reverse domain has less than 3 segments.', () => {
		const eventType = 'com.example';
		assert.throws(
			() => {
				validateType(eventType);
			},
			error => {
				assert.ok(error instanceof ValidationError);
				assert.equal(
					`Failed to validate type: '${eventType}' must be a reverse domain name.`,
					error.message,
				);
				return true;
			},
		);
	});

	test('throws an error if the type has invalid characters.', () => {
		const eventType = 'com.example.apfel-günter.registered';
		assert.throws(
			() => {
				validateType(eventType);
			},
			error => {
				assert.ok(error instanceof ValidationError);
				assert.equal(
					`Failed to validate type: '${eventType}' must be a reverse domain name.`,
					error.message,
				);
				return true;
			},
		);
	});

	test('throws an error if the tld of the reverse domain has less than 1 character.', () => {
		const eventType = 'a.example.exampleType';
		assert.throws(
			() => {
				validateType(eventType);
			},
			error => {
				assert.ok(error instanceof ValidationError);
				assert.equal(
					`Failed to validate type: '${eventType}' must be a reverse domain name.`,
					error.message,
				);
				return true;
			},
		);
	});
});
