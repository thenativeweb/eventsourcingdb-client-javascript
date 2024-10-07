import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import { Client } from '../../Client';
import { Event } from '../../event/Event';
import { validateSubject } from '../../event/validateSubject';
import { CustomError } from '../../util/error/CustomError';
import { InternalError } from '../../util/error/InternalError';
import { InvalidParameterError } from '../../util/error/InvalidParameterError';
import { ServerError } from '../../util/error/ServerError';
import { ValidationError } from '../../util/error/ValidationError';
import { wrapError } from '../../util/error/wrapError';
import { readNdJsonStream } from '../../util/ndjson/readNdJsonStream';
import { StoreItem } from '../StoreItem';
import { isHeartbeat } from '../isHeartbeat';
import { isItem } from '../isItem';
import { isStreamError } from '../isStreamError';
import { ObserveEventsOptions, validateObserveEventsOptions } from './ObserveEventsOptions';

const observeEvents = async function* (
	client: Client,
	abortController: AbortController,
	subject: string,
	options: ObserveEventsOptions,
): AsyncGenerator<StoreItem, void, void> {
	await wrapError(
		() => validateSubject(subject),
		ex => {
			if (ex instanceof ValidationError) {
				throw new InvalidParameterError('subject', ex.message);
			}
		},
	);
	await wrapError(
		() => {
			validateObserveEventsOptions(options);
		},
		ex => {
			if (ex instanceof ValidationError) {
				throw new InvalidParameterError('options', ex.message);
			}
		},
	);

	const requestBody = wrapError(
		() => {
			return JSON.stringify({
				subject,
				options,
			});
		},
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
				path: '/api/observe-events',
				requestBody,
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
		throw new ServerError(
			`Unexpected response status: ${response.status} ${getReasonPhrase(response.status)}.`,
		);
	}

	const stream = response.data;

	const heartbeatInterval = 1_000;
	const heartbeatTimeout = 3 * heartbeatInterval;
	let didTimerFire = false;
	let timer = setTimeout(() => {
		didTimerFire = true;
	}, heartbeatTimeout);

	for await (const message of readNdJsonStream(stream)) {
		if (isHeartbeat(message)) {
			if (didTimerFire) {
				clearTimeout(timer);
				throw new ServerError('Heartbeat timeout.');
			}
			timer = timer.refresh();
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
			`Failed to observe events, an unexpected stream item was received: '${JSON.stringify(
				message,
			)}'.`,
		);
	}
};

export { observeEvents };
