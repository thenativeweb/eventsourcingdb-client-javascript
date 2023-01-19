import { Client } from '../../Client';
import { EventCandidate } from '../../event/EventCandidate';
import axios from 'axios';
import { EventContext } from '../../event/EventContext';
import { retryWithBackoff } from '../../util/retry/retryWithBackoff';
import { wrapError } from '../../util/error/wrapError';

const writeEvents = async function (
	client: Client,
	eventCandidates: EventCandidate[],
	preconditions: string[],
): Promise<EventContext[]> {
	const requestBody = JSON.stringify({
		events: eventCandidates,
		preconditions,
	});

	const httpClient = axios.create({
		baseURL: client.clientConfiguration.baseUrl,
		timeout: client.clientConfiguration.timeoutMilliseconds,
		headers: {
			Authorization: `Bearer ${client.clientConfiguration.accessToken}`,
			'X-EventSourcingDB-Protocol-Version': client.clientConfiguration.protocolVersion,
			'Content-Type': 'application/json',
		},
		responseType: 'json',
	});

	const response = await wrapError(
		async () =>
			retryWithBackoff(new AbortController(), client.clientConfiguration.maxTries, async () =>
				httpClient.post('/api/write-events', requestBody),
			),
		async (error) => new Error('Failed to write events.', { cause: error }),
	);

	if (!Array.isArray(response.data)) {
		throw new Error(`Failed to parse response '${response.data}' to array.`);
	}

	return response.data.map((eventContext): EventContext => EventContext.parse(eventContext));
};

export { writeEvents };
