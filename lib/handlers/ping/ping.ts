import axios from 'axios';
import { Client } from '../../Client';
import { wrapError } from '../../util/error/wrapError';

const ping = async function (client: Client): Promise<void> {
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
		async () => httpClient.get('/ping'),
		async (error) => new Error('Failed to ping the server.', { cause: error }),
	);

	if (response.data !== 'OK') {
		throw new Error('Failed to ping the server.');
	}
};

export { ping };
