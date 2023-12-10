import { StatusCodes } from 'http-status-codes';
import { Client } from '../../Client';
import { CustomError } from '../../util/error/CustomError';
import { InternalError } from '../../util/error/InternalError';
import { ServerError } from '../../util/error/ServerError';
import { wrapError } from '../../util/error/wrapError';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream';
import { isHeartbeat } from '../isHeartbeat';
import { isStreamError } from '../isStreamError';
import { EventType, isEventType } from './EventType';

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
