import { Client } from '../../Client';
import { EventCandidate } from '../../event/EventCandidate';
import { EventContext } from '../../event/EventContext';
import { marshalJson } from '../../util/json/marshalJson';
import { ChainedError } from '../../util/error/ChainedError';
import { wrapError } from '../../util/error/wrapError';
import { Precondition } from './Precondition';

const writeEvents = async function (
	client: Client,
	eventCandidates: EventCandidate[],
	preconditions: Precondition[],
): Promise<EventContext[]> {
	for (const eventCandidate of eventCandidates) {
		eventCandidate.validate();
	}

	const requestBody = marshalJson({
		events: eventCandidates,
		preconditions,
	});
	if (requestBody === undefined) {
		throw new Error('Internal error: Failed to marshal request body.');
	}

	const response = await wrapError(
		async () =>
			client.httpClient.post({
				path: '/api/write-events',
				requestBody,
				responseType: 'json',
			}),
		async (error) => new ChainedError('Failed to write events.', error),
	);

	if (!Array.isArray(response.data)) {
		throw new Error(`Failed to parse response '${response.data}' to array.`);
	}

	return response.data.map((eventContext): EventContext => EventContext.parse(eventContext));
};

export { writeEvents };
