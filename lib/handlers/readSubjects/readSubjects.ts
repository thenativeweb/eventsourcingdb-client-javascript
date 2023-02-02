import { Client } from '../../Client';
import { ReadSubjectsOptions, validateReadSubjectsOptions } from './ReadSubjectsOptions';
import { wrapError } from '../../util/error/wrapError';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream';
import { isStreamError } from '../isStreamError';
import { isSubject } from './isSubject';
import { ValidationError } from '../../util/error/ValidationError';
import { InvalidParameterError } from '../../util/error/InvalidParameterError';
import { CustomError } from '../../util/error/CustomError';
import { InternalError } from '../../util/error/InternalError';
import { ServerError } from '../../util/error/ServerError';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';

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

	const requestBody = wrapError(
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

	if (response.status !== StatusCodes.OK) {
		throw new ServerError(
			`Unexpected response status: ${response.status} ${getReasonPhrase(response.status)}.`,
		);
	}

	const stream = response.data;

	for await (const message of readNdJsonStream(stream)) {
		if (isStreamError(message)) {
			throw new ServerError(message.payload.error);
		}

		if (isSubject(message)) {
			yield message.payload.subject;
			continue;
		}

		throw new ServerError(
			`Failed to read subjects, an unexpected stream item was received: '${JSON.stringify(
				message,
			)}'.`,
		);
	}
};

export { readSubjects };
