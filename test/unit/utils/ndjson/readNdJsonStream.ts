import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { suite, test } from 'node:test';
import type { UnknownObject } from '../../../../src/util/UnknownObject.js';
import { readNdJsonStream } from '../../../../src/util/ndjson/readNdJsonStream.js';

suite('readNdJsonStream', (): void => {
	test('returns an async generator that yields parsed json objects.', async (): Promise<void> => {
		const stream = Readable.from(
			Buffer.from('{"foo":"bar"}\n{"bar":"baz"}\n{"incomplete', 'utf-8'),
		);

		const actualMessages: UnknownObject[] = [];
		for await (const message of readNdJsonStream(stream)) {
			actualMessages.push(message);
		}

		assert.deepEqual(actualMessages, [{ foo: 'bar' }, { bar: 'baz' }]);
	});
});
