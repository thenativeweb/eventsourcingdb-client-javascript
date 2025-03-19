import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import type { Client } from '../../Client.js';
import { CustomError } from '../../util/error/CustomError.js';
import { InternalError } from '../../util/error/InternalError.js';
import { InvalidParameterError } from '../../util/error/InvalidParameterError.js';
import { ServerError } from '../../util/error/ServerError.js';
import { ValidationError } from '../../util/error/ValidationError.js';
import { wrapError } from '../../util/error/wrapError.js';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream.js';
import { isStreamError } from '../isStreamError.js';
import type { ReadSubjectsOptions } from './ReadSubjectsOptions.js';
import { validateReadSubjectsOptions } from './ReadSubjectsOptions.js';
import { isSubject } from './isSubject.js';

const readSubjects = async function* (
	client: Client,
	abortController: AbortController,
	options: ReadSubjectsOptions,
): AsyncGenerator<string, void, void> {
	await wrapError(
		() => {
			validateReadSubjectsOptions(options);
		},
		ex => {
			if (ex instanceof ValidationError) {
				throw new InvalidParameterError('options', ex.message);
			}
		},
	);

	const requestBody = wrapError(
		() => {
			return JSON.stringify(options);
		},
		_ex => {
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
		error => {
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
