import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { LinesDecoder } from '../../../../lib/util/ndjson/LinesDecoder.js';

suite('LinesDecoder', (): void => {
	test('returns all completed lines on write().', (): void => {
		const decoder = new LinesDecoder();

		const actualLines = decoder.write(Buffer.from('hello\nworld\nfoobar'));

		assert.deepEqual(actualLines, ['hello', 'world']);
	});

	test('buffers incomplete lines and returns them on write() as soon as they are completed.', (): void => {
		const decoder = new LinesDecoder();

		let actualLines = decoder.write(Buffer.from('incomplete'));

		assert.deepEqual(actualLines, []);

		actualLines = decoder.write(Buffer.from(' line\n'));

		assert.deepEqual(actualLines, ['incomplete line']);
	});
});
