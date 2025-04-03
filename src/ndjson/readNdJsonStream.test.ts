import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { suite, test } from 'node:test';
import { readNdJsonStream } from './readNdJsonStream.js';

suite('readNdJsonStream', (): void => {
	test('returns an async generator that yields parsed json objects.', async (): Promise<void> => {
		const stream = Readable.from(
			Buffer.from('{"foo":"bar"}\n{"bar":"baz"}\n{"incomplete', 'utf-8'),
		);

		const values: Record<string, unknown>[] = [];
		for await (const value of readNdJsonStream(stream)) {
			values.push(value);
		}

		assert.deepEqual(values, [{ foo: 'bar' }, { bar: 'baz' }]);
	});
});
