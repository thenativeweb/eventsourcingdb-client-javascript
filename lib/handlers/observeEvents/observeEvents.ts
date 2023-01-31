import { Client } from '../../Client';
import { Event } from '../../event/Event';
import { validateSubject } from '../../event/validateSubject';
import { wrapError } from '../../util/error/wrapError';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream';
import { isHeartbeat } from '../isHeartbeat';
import { isItem } from '../isItem';
import { isStreamError } from '../isStreamError';
import { ObserveEventsOptions, validateObserveEventsOptions } from './ObserveEventsOptions';
import { StoreItem } from '../StoreItem';
import { ServerError } from '../../util/error/ServerError';
import { CustomError } from '../../util/error/CustomError';
import { InvalidParameterError } from '../../util/error/InvalidParameterError';
import { ValidationError } from '../../util/error/ValidationError';
import { InternalError } from '../../util/error/InternalError';

const observeEvents = async function* (
	client: Client,
	abortController: AbortController,
	subject: string,
	options: ObserveEventsOptions,
): AsyncGenerator<StoreItem, void, void> {
	await wrapError(
		() => validateSubject(subject),
		(ex) => {
			if (ex instanceof ValidationError) {
				throw new InvalidParameterError('subject', ex.message);
			}
		},
	);
	await wrapError(
		() => {
			validateObserveEventsOptions(options);
		},
		(ex) => {
			if (ex instanceof ValidationError) {
				throw new InvalidParameterError('options', ex.message);
			}
		},
	);

	const requestBody = await wrapError(
		() => {
			return JSON.stringify({
				subject,
				options,
			});
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
				path: '/api/observe-events',
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
		if (isHeartbeat(message)) {
			continue;
		}
		if (isStreamError(message)) {
			throw new ServerError(message.payload.error);
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
			`Failed to observe events, an unexpected stream item was received: '${message}'.`,
		);
	}
};

export { observeEvents };
