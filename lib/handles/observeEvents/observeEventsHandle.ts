import axios from 'axios';
import { StringDecoder } from 'string_decoder';
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
	const decoder = new StringDecoder('utf-8');
	let textBuffer = '';
	const linesBuffer: string[] = [];

	for await (const chunk of new StreamToAsyncIterator<Buffer>(stream)) {
		textBuffer += decoder.write(chunk);
		
		readLinesFromBuffer:
			while (true) {
				for (let charIndex = 0; charIndex < textBuffer.length; charIndex++) {
					const char = textBuffer[charIndex];

					if (char !== '\n') {
						continue;
					}

					const line = textBuffer.slice(0, charIndex);
					const rest = textBuffer.slice(charIndex + 1);

					textBuffer = rest;
					linesBuffer.push(line);

					continue readLinesFromBuffer;
				}

				break
			}

			while (linesBuffer.length > 0) {
				const line = linesBuffer.shift()!;
				const message = JSON.parse(line);

				if (isHeartbeat(message)) {
					continue;
				}
				if (isObserveEventsError(message)) {
					throw new Error(
						`an error occurred during observe events: ${ message.payload.error }`
					);
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
				
				throw new Error(`unexpected stream item: ${ message }`);
			}
	}
};

export { observeEventsHandle };
