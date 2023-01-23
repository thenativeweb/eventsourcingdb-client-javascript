import { Client } from '../../Client';
import { EventCandidate } from '../../event/EventCandidate';
import axios from 'axios';
import { EventContext } from '../../event/EventContext';
import { ChainedError } from '../../util/error/ChainedError';
import { retryWithBackoff } from '../../util/retry/retryWithBackoff';
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

	const requestBody = JSON.stringify({
		events: eventCandidates,
		preconditions,
	});

	const httpClient = axios.create({
		baseURL: client.configuration.baseUrl,
		timeout: client.configuration.timeoutMilliseconds,
		headers: {
			Authorization: `Bearer ${client.configuration.accessToken}`,
			'X-EventSourcingDB-Protocol-Version': client.configuration.protocolVersion,
			'Content-Type': 'application/json',
		},
		responseType: 'json',
	});

	const response = await wrapError(
		async () =>
			retryWithBackoff(new AbortController(), client.configuration.maxTries, async () =>
				httpClient.post('/api/write-events', requestBody),
			),
		async (error) => new ChainedError('Failed to write events.', error),
	);

	if (!Array.isArray(response.data)) {
		throw new Error(`Failed to parse response '${response.data}' to array.`);
	}

	return response.data.map((eventContext): EventContext => EventContext.parse(eventContext));
};

export { writeEvents };
