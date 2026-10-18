import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { getRawJsonMember } from './getRawJsonMember.js';

suite('getRawJsonMember', (): void => {
	test('returns the value of a member exactly as the text contains it.', (): void => {
		const text = '{"data": { "b" : 1.0, "a":"\\u003c&\\"}" } ,"hash":"x"}';

		assert.equal(getRawJsonMember(text, 'data'), '{ "b" : 1.0, "a":"\\u003c&\\"}" }');
		assert.equal(getRawJsonMember(text, 'hash'), '"x"');
	});

	test('skips members whose values contain brackets, braces, and quotes.', (): void => {
		const text = '{"a":["]","}",{"b":"\\\\"}],"c":{"d":"{["},"data":[1,2]}';

		assert.equal(getRawJsonMember(text, 'data'), '[1,2]');
	});

	test('returns numbers, literals, and null as the text contains them.', (): void => {
		const text = '{ "a" : 1e2 , "b":true,"c":null }';

		assert.equal(getRawJsonMember(text, 'a'), '1e2');
		assert.equal(getRawJsonMember(text, 'b'), 'true');
		assert.equal(getRawJsonMember(text, 'c'), 'null');
	});

	test('matches keys that the text escapes.', (): void => {
		assert.equal(getRawJsonMember('{"d\\u0061ta":{}}', 'data'), '{}');
	});

	test('returns the last member if a key occurs more than once, as JSON.parse does.', (): void => {
		assert.equal(getRawJsonMember('{"data":1,"data":2}', 'data'), '2');
	});

	test('returns undefined if there is no such member.', (): void => {
		assert.equal(getRawJsonMember('{"a":{"data":1}}', 'data'), undefined);
		assert.equal(getRawJsonMember('{}', 'data'), undefined);
	});

	test('returns undefined if the text is not an object.', (): void => {
		assert.equal(getRawJsonMember('[{"data":1}]', 'data'), undefined);
	});
});
