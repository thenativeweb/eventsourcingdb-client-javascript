import { StatusCodes } from 'http-status-codes';
import { Client } from '../../Client';
import { EventCandidate } from '../../event/EventCandidate';
import { EventContext } from '../../event/EventContext';
import { marshalJson } from '../../util/json/marshalJson';
import { wrapError } from '../../util/error/wrapError';
import { Precondition } from './Precondition';
import { ValidationError } from '../../util/error/ValidationError';
import { InvalidParameterError } from '../../util/error/InvalidParameterError';
import { InternalError } from '../../util/error/InternalError';
import { CustomError } from '../../util/error/CustomError';
import { ServerError } from '../../util/error/ServerError';

const writeEvents = async function (
	client: Client,
	eventCandidates: EventCandidate[],
	preconditions: Precondition[],
): Promise<EventContext[]> {
	if (eventCandidates.length < 1) {
		throw new InvalidParameterError(
			'eventCandidates',
			'eventCandidates must contain at least one EventCandidate.',
		);
	}
	for (const eventCandidate of eventCandidates) {
		await wrapError(
			() => {
				eventCandidate.validate();
			},
			(ex) => {
				if (ex instanceof ValidationError) {
					throw new InvalidParameterError('eventCandidates', ex.message);
				}
			},
		);
	}

	const requestBody = await wrapError(
		() => {
			return marshalJson({
				events: eventCandidates,
				preconditions,
			});
		},
		(ex) => {
			throw new InvalidParameterError('options', ex.message);
		},
	);
	if (requestBody === undefined) {
		throw new InternalError('Failed to marshal request body.');
	}

	const response = await wrapError(
		async () =>
			client.httpClient.post({
				path: '/api/write-events',
				requestBody,
				responseType: 'json',
			}),
		async (error) => {
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
	return await wrapError(
		() => responseData.map((eventContext): EventContext => EventContext.parse(eventContext)),
		(error) => {
			if (error instanceof ValidationError) {
				throw new ServerError(error.message);
			}

			throw new InternalError(error);
		},
	);
};

export { writeEvents };
