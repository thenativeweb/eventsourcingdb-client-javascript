import { Readable } from 'stream';
import StreamToAsyncIterator from 'stream-to-async-iterator';
import { UnknownObject } from '../UnknownObject';
import { LinesDecoder } from './LinesDecoder';
import { CancelationError } from '../error/CancelationError';
import { CanceledError } from 'axios';
import { ServerError } from '../error/ServerError';

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
