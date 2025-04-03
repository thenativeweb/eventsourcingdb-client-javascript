import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { LinesDecoder } from '../../../src/ndjson/LinesDecoder.js';

suite('LinesDecoder', (): void => {
	test('returns all completed lines on write().', (): void => {
		const decoder = new LinesDecoder();

		const lines = decoder.write(Buffer.from('hello\nworld\nfoobar'));
		assert.deepEqual(lines, ['hello', 'world']);
	});

	test('buffers incomplete lines and returns them on write() as soon as they are completed.', (): void => {
		const decoder = new LinesDecoder();

		let lines = decoder.write(Buffer.from('incomplete'));
		assert.deepEqual(lines, []);

		lines = decoder.write(Buffer.from(' line\n'));
		assert.deepEqual(lines, ['incomplete line']);
	});
});
