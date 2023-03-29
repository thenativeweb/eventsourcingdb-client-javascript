import { LinesDecoder } from '../../../../lib/util/ndjson/LinesDecoder';
import { assert } from 'assertthat';

suite('LinesDecoder', (): void => {
	test('returns all completed lines on write().', async (): Promise<void> => {
		const decoder = new LinesDecoder();

		const actualLines = decoder.write(Buffer.from('hello\nworld\nfoobar'));

		assert.that(actualLines).is.equalTo(['hello', 'world']);
	});

	test('buffers incomplete lines and returns them on write() as soon as they are completed.', async (): Promise<void> => {
		const decoder = new LinesDecoder();

		let actualLines = decoder.write(Buffer.from('incomplete'));

		assert.that(actualLines).is.equalTo([]);

		actualLines = decoder.write(Buffer.from(' line\n'));

		assert.that(actualLines).is.equalTo(['incomplete line']);
	});
});
