import { StatusCodes } from 'http-status-codes';
import { Client } from '../../Client';
import { Event } from '../../event/Event';
import { validateSubject } from '../../event/validateSubject';
import { CustomError } from '../../util/error/CustomError';
import { InternalError } from '../../util/error/InternalError';
import { InvalidParameterError } from '../../util/error/InvalidParameterError';
import { ServerError } from '../../util/error/ServerError';
import { ValidationError } from '../../util/error/ValidationError';
import { wrapError } from '../../util/error/wrapError';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream';
import { StoreItem } from '../StoreItem';
import { isHeartbeat } from '../isHeartbeat';
import { isItem } from '../isItem';
import { isStreamError } from '../isStreamError';
import { ReadEventsOptions, validateReadEventsOptions } from './ReadEventsOptions';

const readEvents = async function* (
	client: Client,
	abortController: AbortController,
	subject: string,
	options: ReadEventsOptions,
): AsyncGenerator<StoreItem, void, void> {
	wrapError(
		() => validateSubject(subject),
		ex => {
			if (ex instanceof ValidationError) {
				throw new InvalidParameterError('subject', ex.message);
			}
		},
	);
	wrapError(
		() => {
			validateReadEventsOptions(options);
		},
		ex => {
			if (ex instanceof ValidationError) {
				throw new InvalidParameterError('options', ex.message);
			}
		},
	);

	const requestBody = wrapError(
		() =>
			JSON.stringify({
				subject,
				options,
			}),
		() => {
			throw new InvalidParameterError(
				'options',
				'Parameter contains values that cannot be marshaled.',
			);
		},
	);

	const response = await wrapError(
		async () =>
			client.httpClient.post({
				path: '/api/read-events',
				requestBody,
				responseType: 'stream',
				abortController,
			}),
		async error => {
			if (error instanceof CustomError) {
				throw error;
			}

			throw new InternalError(error);
		},
	);
	if (response.status !== StatusCodes.OK) {
		throw new ServerError(`Unexpected response status: ${response.status} ${response.statusText}.`);
	}

	const stream = response.data;

	for await (const message of readNdJsonStream(stream)) {
		if (isHeartbeat(message)) {
			continue;
		}
		if (isStreamError(message)) {
			throw new ServerError(`${message.payload.error}.`);
		}
		if (isItem(message)) {
			const event = Event.parse(message.payload.event);

			yield {
				event,
				hash: message.payload.hash,
			};

			continue;
		}

		throw new ServerError(
			`Failed to read events, an unexpected stream item was received: '${JSON.stringify(
				message,
			)}'.`,
		);
	}
};

export { readEvents };
