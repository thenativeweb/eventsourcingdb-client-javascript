import { StatusCodes } from 'http-status-codes';
import type { Client } from '../../Client.js';
import type { EventCandidate } from '../../event/EventCandidate.js';
import { EventContext } from '../../event/EventContext.js';
import { CustomError } from '../../util/error/CustomError.js';
import { InternalError } from '../../util/error/InternalError.js';
import { InvalidParameterError } from '../../util/error/InvalidParameterError.js';
import { ServerError } from '../../util/error/ServerError.js';
import { ValidationError } from '../../util/error/ValidationError.js';
import { wrapError } from '../../util/error/wrapError.js';
import type { Precondition } from './Precondition.js';

const writeEvents = async (
	client: Client,
	eventCandidates: EventCandidate[],
	preconditions: Precondition[],
): Promise<EventContext[]> => {
	if (eventCandidates.length === 0) {
		throw new InvalidParameterError(
			'eventCandidates',
			'eventCandidates must contain at least one EventCandidate.',
		);
	}
	for (const eventCandidate of eventCandidates) {
		wrapError(
			() => {
				eventCandidate.validate();
			},
			ex => {
				if (ex instanceof ValidationError) {
					throw new InvalidParameterError('eventCandidates', ex.message);
				}
			},
		);
	}

	const requestBody = JSON.stringify({
		events: eventCandidates,
		preconditions,
	});

	const response = await wrapError(
		async () =>
			client.httpClient.post({
				path: '/api/write-events',
				requestBody,
				responseType: 'json',
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

	if (!Array.isArray(response.data)) {
		throw new ServerError(`Failed to parse response '${response.data}' to array.`);
	}

	const responseData = response.data;
	return wrapError(
		() => responseData.map((eventContext): EventContext => EventContext.parse(eventContext)),
		error => {
			if (error instanceof ValidationError) {
				throw new ServerError(error.message);
			}

			throw new InternalError(error);
		},
	);
};

export { writeEvents };
