import { StatusCodes } from 'http-status-codes';
import type { Client } from '../../Client.js';
import { validateType } from '../../event/validateType.js';
import { CustomError } from '../../util/error/CustomError.js';
import { InternalError } from '../../util/error/InternalError.js';
import { InvalidParameterError } from '../../util/error/InvalidParameterError.js';
import { ServerError } from '../../util/error/ServerError.js';
import { ValidationError } from '../../util/error/ValidationError.js';
import { wrapError } from '../../util/error/wrapError.js';

const registerEventSchema = async (
	client: Client,
	eventType: string,
	schema: object | string,
): Promise<void> => {
	wrapError(
		() => validateType(eventType),
		ex => {
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
		error => {
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
