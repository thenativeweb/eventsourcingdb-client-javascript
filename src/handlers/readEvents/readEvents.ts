import { StatusCodes } from 'http-status-codes';
import type { Client } from '../../Client.js';
import { Event } from '../../event/Event.js';
import { validateSubject } from '../../event/validateSubject.js';
import { CustomError } from '../../util/error/CustomError.js';
import { InternalError } from '../../util/error/InternalError.js';
import { InvalidParameterError } from '../../util/error/InvalidParameterError.js';
import { ServerError } from '../../util/error/ServerError.js';
import { ValidationError } from '../../util/error/ValidationError.js';
import { wrapError } from '../../util/error/wrapError.js';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream.js';
import type { StoreItem } from '../StoreItem.js';
import { isHeartbeat } from '../isHeartbeat.js';
import { isItem } from '../isItem.js';
import { isStreamError } from '../isStreamError.js';
import type { ReadEventsOptions } from './ReadEventsOptions.js';
import { validateReadEventsOptions } from './ReadEventsOptions.js';

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
		error => {
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
