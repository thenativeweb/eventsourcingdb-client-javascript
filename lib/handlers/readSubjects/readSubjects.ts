import { Client } from '../../Client';
import { ReadSubjectsOptions, validateReadSubjectsOptions } from './ReadSubjectsOptions';
import { wrapError } from '../../util/error/wrapError';
import { ChainedError } from '../../util/error/ChainedError';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream';
import { isStreamError } from '../isStreamError';
import { isSubject } from './isSubject';
import { CancelationError } from '../../util/error/CancelationError';
import { ValidationError } from '../../util/error/ValidationError';
import { InvalidParameterError } from '../../util/error/InvalidParameterError';
import { CustomError } from '../../util/error/CustomError';
import { InternalError } from '../../util/error/InternalError';
import { ServerError } from '../../util/error/ServerError';

const readSubjects = async function* (
	client: Client,
	abortController: AbortController,
	options: ReadSubjectsOptions,
): AsyncGenerator<string, void, void> {
	await wrapError(
		() => {
			validateReadSubjectsOptions(options);
		},
		(ex) => {
			if (ex instanceof ValidationError) {
				throw new InvalidParameterError('options', ex.message);
			}
		},
	);

	const requestBody = await wrapError(
		() => {
			return JSON.stringify(options);
		},
		(ex) => {
			throw new InvalidParameterError(
				'options',
				'Parameter contains values that cannot be marshaled.',
			);
		},
	);

	const response = await wrapError(
		async () =>
			client.httpClient.post({
				path: '/api/read-subjects',
				requestBody,
				responseType: 'stream',
				abortController,
			}),
		async (error) => {
			if (error instanceof CustomError) {
				throw error;
			}

			throw new InternalError(error);
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

		throw new ServerError(
			`Failed to read subjects, an unexpected stream item was received: '${message}'.`,
		);
	}
};

export { readSubjects };
