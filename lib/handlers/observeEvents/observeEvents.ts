import axios, { AxiosResponse } from 'axios';
import { StatusCodes } from 'http-status-codes';
import { Readable } from 'stream';
import { Client } from '../../Client';
import { Event } from '../../event/Event';
import { wrapError } from '../../util/error/wrapError';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream';
import { retryWithBackoff } from '../../util/retry/retryWithBackoff';
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

	const httpClient = axios.create({
		baseURL: client.clientConfiguration.baseUrl,
		timeout: client.clientConfiguration.timeoutMilliseconds,
		headers: {
			Authorization: `Bearer ${client.clientConfiguration.accessToken}`,
			'X-EventSourcingDB-Protocol-Version': client.clientConfiguration.protocolVersion,
			'Content-Type': 'application/json',
		},
		responseType: 'stream',
	});

	const response = await wrapError(
		async () =>
			retryWithBackoff(abortController, client.clientConfiguration.maxTries, async () =>
				httpClient.post<Readable>('/api/observe-events', requestBody, {
					signal: abortController.signal,
				}),
			),
		async (error) => new Error('Failed to observe events.', { cause: error }),
	);

	client.validateProtocolVersion(response.status, response.headers);

	if (response.status !== StatusCodes.OK) {
		throw new Error(`Failed to observe events, received status '${response.status}'.`);
	}

	const stream = response.data;

	// TODO: we might need to close the stream, if axios doesn't already do that
	// when the AbortController is cancelled.
	for await (const message of readNdJsonStream(stream)) {
		if (isHeartbeat(message)) {
			continue;
		}
		if (isObserveEventsError(message)) {
			throw new Error(`Failed to observe events because of an error '${message.payload.error}'.`);
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
