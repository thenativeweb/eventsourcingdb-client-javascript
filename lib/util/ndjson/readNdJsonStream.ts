import type { Readable } from 'node:stream';
import { CanceledError } from 'axios';
import StreamToAsyncIterator from 'stream-to-async-iterator';
import type { UnknownObject } from '../UnknownObject.js';
import { CancelationError } from '../error/CancelationError.js';
import { ServerError } from '../error/ServerError.js';
import { LinesDecoder } from './LinesDecoder.js';

const readNdJsonStream = async function* (
	stream: Readable,
): AsyncGenerator<UnknownObject, void, void> {
	const decoder = new LinesDecoder('utf-8');

	try {
		for await (const chunk of new StreamToAsyncIterator<Buffer>(stream)) {
			const lines = decoder.write(chunk);

			for (const line of lines) {
				const parsedLine = JSON.parse(line);

				yield parsedLine;
			}
		}
	} catch (ex: unknown) {
		if (ex instanceof CanceledError) {
			throw new CancelationError();
		}

		throw new ServerError('Failed to read response.');
	}
};

export { readNdJsonStream };
