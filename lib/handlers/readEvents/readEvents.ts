import { CanceledError } from 'axios';
import { Client } from '../../Client';
import { validateSubject } from '../../event/validateSubject';
import { ChainedError } from '../../util/error/ChainedError';
import { wrapError } from '../../util/error/wrapError';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream';
import { isHeartbeat } from '../isHeartbeat';
import { isItem } from '../isItem';
import { isStreamError } from '../isStreamError';
import { StoreItem } from '../StoreItem';
import { ReadEventsOptions, validateReadEventsOptions } from './ReadEventsOptions';
import { Event } from '../../event/Event';

const readEvents = async function* (
	client: Client,
	abortController: AbortController,
	subject: string,
	options: ReadEventsOptions,
): AsyncGenerator<StoreItem, void, void> {
	validateSubject(subject);
	validateReadEventsOptions(options);

	const requestBody = JSON.stringify({
		subject,
		options,
	});

	const response = await wrapError(
		async () =>
			client.httpClient.post({
				path: '/api/read-events',
				requestBody,
				responseType: 'stream',
				abortController,
			}),
		async (error) => {
			if (error instanceof CanceledError) {
				return error;
			}

			return new ChainedError('Failed to read events.', error);
		},
	);

	const stream = response.data;

	for await (const message of readNdJsonStream(stream)) {
		if (isHeartbeat(message)) {
			continue;
		}
		if (isStreamError(message)) {
			throw new ChainedError('Failed to read events.', new Error(message.payload.error));
		}
		if (isItem(message)) {
			const event = Event.parse(message.payload.event);

			yield {
				event,
				hash: message.payload.hash,
			};

			continue;
		}

		throw new Error(`Failed to read events, an unexpected stream item was received: '${message}'.`);
	}
};

export { readEvents };
