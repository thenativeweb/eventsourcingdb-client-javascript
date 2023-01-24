import { Client } from '../../Client';
import { Event } from '../../event/Event';
import { validateSubject } from '../../event/validateSubject';
import { ChainedError } from '../../util/error/ChainedError';
import { wrapError } from '../../util/error/wrapError';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream';
import { isHeartbeat } from '../isHeartbeat';
import { isItem } from '../isItem';
import { isStreamError } from '../isStreamError';
import { ObserveEventsOptions, validateObserveEventsOptions } from './ObserveEventsOptions';
import { StoreItem } from '../StoreItem';
import { CancelationError } from '../../util/error/CancelationError';
import { CanceledError } from 'axios';

const observeEvents = async function* (
	client: Client,
	abortController: AbortController,
	subject: string,
	options: ObserveEventsOptions,
): AsyncGenerator<StoreItem, void, void> {
	validateSubject(subject);
	validateObserveEventsOptions(options);

	const requestBody = JSON.stringify({
		subject,
		options,
	});

	const response = await wrapError(
		async () =>
			client.httpClient.post({
				path: '/api/observe-events',
				requestBody,
				responseType: 'stream',
				abortController,
			}),
		async (error) => {
			if (error instanceof CancelationError) {
				return error;
			}

			return new ChainedError('Failed to observe events.', error);
		},
	);

	const stream = response.data;

	for await (const message of readNdJsonStream(stream)) {
		if (isHeartbeat(message)) {
			continue;
		}
		if (isStreamError(message)) {
			throw new ChainedError('Failed to observe events.', new Error(message.payload.error));
		}
		if (isItem(message)) {
			const event = Event.parse(message.payload.event);

			yield {
				event,
				hash: message.payload.hash,
			};

			continue;
		}

		throw new Error(
			`Failed to observe events, an unexpected stream item was received: '${message}'.`,
		);
	}
};

export { observeEvents };
