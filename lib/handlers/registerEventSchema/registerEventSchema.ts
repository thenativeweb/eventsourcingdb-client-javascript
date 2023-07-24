import { Client } from "../../Client";
import { CustomError } from "../../util/error/CustomError";
import { InternalError } from "../../util/error/InternalError";
import { ServerError } from "../../util/error/ServerError";
import { wrapError } from "../../util/error/wrapError";
import { StatusCodes } from "http-status-codes";

const registerEventSchema = async function (
    client: Client,
    eventType: string,
    schema: object | string,
): Promise<void> {
    let schemaString = schema;
    if (typeof schema == "object") {
        schemaString = JSON.stringify(schema)
    }

    const requestBody = JSON.stringify({
        eventType,
        schema: schemaString,
    });

    const response = await wrapError(
        async () => client.httpClient.post({
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
        throw new ServerError(`Unexpected response status: ${response.status} ${response.statusText}: ${response.data}.`);
    }
}

export { registerEventSchema };
