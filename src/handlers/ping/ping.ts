import type { Client } from '../../Client.js';
import { CustomError } from '../../util/error/CustomError.js';
import { InternalError } from '../../util/error/InternalError.js';
import { ServerError } from '../../util/error/ServerError.js';
import { wrapError } from '../../util/error/wrapError.js';

const ping = async (client: Client): Promise<void> => {
	const response = await wrapError(
		async () =>
			client.httpClient.get({
				path: '/api/ping',
				responseType: 'text',
				withAuthorization: false,
			}),
		error => {
			if (error instanceof CustomError) {
				throw error;
			}

			new InternalError(error);
		},
	);

	if (response.data !== 'OK') {
		throw new ServerError('Received unexpected response.');
	}
};

export { ping };
