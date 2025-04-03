import type { Readable } from 'node:stream';
import StreamToAsyncIterator from 'stream-to-async-iterator';
import { LinesDecoder } from './LinesDecoder.js';

const readNdJsonStream = async function* (
	stream: Readable,
): AsyncGenerator<Record<string, unknown>, void, void> {
	const decoder = new LinesDecoder('utf-8');

	for await (const chunk of new StreamToAsyncIterator<Buffer>(stream)) {
		const lines = decoder.write(chunk);

		for (const line of lines) {
			const parsedLine = JSON.parse(line);

			yield parsedLine;
		}
	}
};

export { readNdJsonStream };
