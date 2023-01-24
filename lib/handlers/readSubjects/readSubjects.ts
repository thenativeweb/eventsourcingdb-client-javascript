import { Client } from '../../Client';
import { ReadSyncOptions } from 'fs';
import { validateReadEventsOptions } from '../readEvents/ReadEventsOptions';
import { ReadSubjectsOptions, validateReadSubjectsOptions } from './ReadSubjectsOptions';
import { wrapError } from '../../util/error/wrapError';
import { CanceledError } from 'axios';
import { ChainedError } from '../../util/error/ChainedError';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream';
import { isStreamError } from '../isStreamError';
import { isSubject } from './isSubject';

const readSubjects = async function* (
	client: Client,
	abortController: AbortController,
	options: ReadSubjectsOptions,
): AsyncGenerator<string, void, void> {
	validateReadSubjectsOptions(options);

	const requestBody = JSON.stringify(options);

	const response = await wrapError(
		async () =>
			client.httpClient.post({
				path: '/api/read-subjects',
				requestBody,
				responseType: 'stream',
				abortController,
			}),
		async (error) => {
			if (error instanceof CanceledError) {
				return error;
			}

			return new ChainedError('Failed to read subjects.', error);
		},
	);

	const stream = response.data;

	for await (const message of readNdJsonStream(stream)) {
		if (isStreamError(message)) {
			throw new ChainedError('Failed to read subjects.', new Error(message.payload.error));
		}

		if (isSubject(message)) {
			yield message.payload.subject;
			continue;
		}

		throw new Error(
			`Failed to read subjects, an unexpected stream item was received: '${message}'.`,
		);
	}
};

export { readSubjects };
