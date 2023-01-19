import { Client } from '../../Client';
import { EventCandidate } from '../../event/EventCandidate';
import axios from 'axios';
import { EventContext } from '../../event/EventContext';

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

	// TODO: Add retries here
	const response = await httpClient.post('/api/write-events', requestBody);

	if (!Array.isArray(response.data)) {
		throw new Error(`Failed to parse response '${response.data}' to array.`);
	}

	return response.data.map((eventContext): EventContext => EventContext.parse(eventContext));
};

export { writeEvents };
