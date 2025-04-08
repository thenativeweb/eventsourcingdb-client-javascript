import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { suite, test } from 'node:test';
import { readNdJsonStream } from './readNdJsonStream.js';

function convertStreamToWebStream(stream: Readable): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			stream.on('data', chunk => {
				controller.enqueue(new Uint8Array(chunk));
			});
			stream.on('end', () => {
				controller.close();
			});
			stream.on('error', err => {
				controller.error(err);
			});
		},
	});
}

suite('readNdJsonStream', (): void => {
	test('returns an async generator that yields parsed json objects.', async (): Promise<void> => {
		const stream = convertStreamToWebStream(
			Readable.from(Buffer.from('{"foo":"bar"}\n{"bar":"baz"}\n{"incomplete', 'utf-8')),
		);

		const controller = new AbortController();

		const values: Record<string, unknown>[] = [];
		for await (const value of readNdJsonStream(stream, controller.signal)) {
			values.push(value);
		}

		assert.deepEqual(values, [{ foo: 'bar' }, { bar: 'baz' }]);
	});
});
