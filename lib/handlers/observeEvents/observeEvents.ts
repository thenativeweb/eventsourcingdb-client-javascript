import { Client } from '../../Client';
import { Event } from '../../event/Event';
import { ChainedError } from '../../util/error/ChainedError';
import { wrapError } from '../../util/error/wrapError';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream';
import { isHeartbeat } from './isHeartbeat';
import { isItem } from './isItem';
import { isObserveEventsError } from './isObserveEventsError';
import { ObserveEventsOptions } from './ObserveEventsOptions';
import { StoreItem } from './StoreItem';

const observeEvents = async function* (
	client: Client,
	abortController: AbortController,
	subject: string,
	options: ObserveEventsOptions,
): AsyncGenerator<StoreItem, void, void> {
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
		async (error) => new ChainedError('Failed to observe events.', error),
	);

	const stream = response.data;

	// TODO: we might need to close the stream, if axios doesn't already do that
	// when the AbortController is cancelled.
	for await (const message of readNdJsonStream(stream)) {
		if (isHeartbeat(message)) {
			continue;
		}
		if (isObserveEventsError(message)) {
			throw new ChainedError('Failed to observe events.', new Error(message.payload.error));
		}
		if (isItem(message)) {
			const event = Event.parse(message.payload.event);

			yield {
				type: 'item',
				payload: {
					event,
					hash: message.payload.hash,
				},
			};

			continue;
		}

		throw new Error(
			`Failed to observe events, an unexpected stream item was received: '${message}'.`,
		);
	}
};

export { observeEvents };
