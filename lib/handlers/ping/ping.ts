import { Client } from '../../Client';
import { CustomError } from '../../util/error/CustomError';
import { InternalError } from '../../util/error/InternalError';
import { ServerError } from '../../util/error/ServerError';
import { wrapError } from '../../util/error/wrapError';

const ping = async function (client: Client): Promise<void> {
	const response = await wrapError(
		async () =>
			client.httpClient.get({
				path: '/ping',
				responseType: 'text',
				withAuthorization: false,
			}),
		async (error) => {
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
