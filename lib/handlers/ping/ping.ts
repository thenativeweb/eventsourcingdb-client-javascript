import { Client } from '../../Client';
import { ChainedError } from '../../util/error/ChainedError';
import { wrapError } from '../../util/error/wrapError';

const ping = async function (client: Client): Promise<void> {
	const response = await wrapError(
		async () =>
			client.httpClient.get({
				path: '/ping',
				responseType: 'text',
				skipAuthorization: true,
			}),
		async (error) => new ChainedError('Failed to ping the server.', error),
	);

	if (response.data !== 'OK') {
		throw new Error('Failed to ping the server.');
	}
};

export { ping };
