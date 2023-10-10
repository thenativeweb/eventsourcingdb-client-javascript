import { StatusCodes } from 'http-status-codes';
import { Client } from '../../Client';
import { validateType } from '../../event/validateType';
import { CustomError } from '../../util/error/CustomError';
import { InternalError } from '../../util/error/InternalError';
import { InvalidParameterError } from '../../util/error/InvalidParameterError';
import { ServerError } from '../../util/error/ServerError';
import { ValidationError } from '../../util/error/ValidationError';
import { wrapError } from '../../util/error/wrapError';

const registerEventSchema = async function (
	client: Client,
	eventType: string,
	schema: object | string,
): Promise<void> {
	wrapError(
		() => validateType(eventType),
		(ex) => {
			if (ex instanceof ValidationError) {
				throw new InvalidParameterError('eventType', ex.message);
			}
		},
	);

	let schemaString = schema;
	if (typeof schema === 'object') {
		schemaString = JSON.stringify(schema);
	}

	const requestBody = JSON.stringify({
		eventType,
		schema: schemaString,
	});

	const response = await wrapError(
		async () =>
			client.httpClient.post({
				path: '/api/register-event-schema',
				requestBody,
				responseType: 'text',
			}),
		async (error) => {
			if (error instanceof CustomError) {
				throw error;
			}

			throw new InternalError(error);
		},
	);
	if (response.status !== StatusCodes.OK) {
		throw new ServerError(
			`Unexpected response status: ${response.status} ${response.statusText}: ${response.data}.`,
		);
	}
};

export { registerEventSchema };
