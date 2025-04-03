import { StatusCodes } from 'http-status-codes';
import type { Client } from '../../Client.js';
import { CustomError } from '../../util/error/CustomError.js';
import { InternalError } from '../../util/error/InternalError.js';
import { ServerError } from '../../util/error/ServerError.js';
import { wrapError } from '../../util/error/wrapError.js';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream.js';
import { isHeartbeat } from '../isHeartbeat.js';
import { isStreamError } from '../isStreamError.js';
import type { EventType } from './EventType.js';
import { isEventType } from './EventType.js';

const readEventTypes = async function* (
	client: Client,
	abortController: AbortController,
): AsyncGenerator<EventType, void, void> {
	const response = await wrapError(
		async () =>
			client.httpClient.post({
				path: '/api/read-event-types',
				requestBody: '',
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
		if (isEventType(message)) {
			yield message.payload;
			continue;
		}

		throw new ServerError(
			`Failed to read events, an unexpected stream item was received: '${JSON.stringify(
				message,
			)}'.`,
		);
	}
};

export { readEventTypes };
