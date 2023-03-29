import { UnknownObject } from '../../../../lib/util/UnknownObject';
import { readNdJsonStream } from '../../../../lib/util/ndjson/readNdJsonStream';
import { assert } from 'assertthat';
import { Readable } from 'stream';

suite('readNdJsonStream', (): void => {
	test('returns an async generator that yields parsed json objects.', async (): Promise<void> => {
		const stream = Readable.from(
			Buffer.from('{"foo":"bar"}\n{"bar":"baz"}\n{"incomplete', 'utf-8'),
		);

		const actualMessages: UnknownObject[] = [];
		for await (const message of readNdJsonStream(stream)) {
			actualMessages.push(message);
		}

		assert.that(actualMessages).is.equalTo([{ foo: 'bar' }, { bar: 'baz' }]);
	});
});
