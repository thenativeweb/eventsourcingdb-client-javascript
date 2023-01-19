import axios from 'axios';
import { Client } from '../../Client';
import { Event } from '../../event/Event';
import { isHeartbeat } from './isHeartbeat';
import { isItem } from './isItem';
import { isObserveEventsError } from './isObserveEventsError';
import { ObserveEventsOptions } from './ObserveEventsOptions';
import { Readable } from 'stream';
import { StatusCodes } from 'http-status-codes';
import { StoreItem } from './StoreItem';
import StreamToAsyncIterator from 'stream-to-async-iterator';

const observeEventsHandle = async function* (
	client: Client,
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

	// TODO: Add retries here
	const response = await httpClient.post<Readable>('/api/observe-events', requestBody);

	client.validateProtocolVersion(response.status, response.headers);

	if (response.status !== StatusCodes.OK) {
		throw new Error(`failed to observe events: ${response.status}`);
	}

	const stream = response.data;

	for await (const chunk of new StreamToAsyncIterator<string>(stream)) {
		if (typeof chunk !== 'string') {
			throw new Error(`unexpected stream item: ${chunk}`);
		}

		const lines = chunk.trim().split('\n');

		for (const line of lines) {
			const message = JSON.parse(line);

			if (isHeartbeat(message)) {
				continue;
			}

			if (isObserveEventsError(message)) {
				throw new Error(`an error occurred during observe events: ${message.payload.error}`);
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

			throw new Error(`unexpected stream item: ${message}`);
		}
	}
};

export { observeEventsHandle };
