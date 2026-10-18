import { DbApiError } from '../DbApiError.js';
import { readResponseText } from '../stall/readResponseText.js';
import type { StallGuard } from '../stall/StallGuard.js';
import { parseRetryAfter } from './parseRetryAfter.js';

const statusTooManyRequests = 429;

// Creates the error for a response with a status other than 200, whose body
// is a text that describes the error. The text ends with a line break, which
// is not part of the description.
const createDbApiErrorFromResponse = async (
	response: Response,
	stallGuard: StallGuard,
	getCode?: (status: number, description: string) => string | undefined,
): Promise<DbApiError> => {
	const { status } = response;
	const description = (await readResponseText(response, stallGuard)).trim();

	return new DbApiError({
		status,
		description,
		code: getCode?.(status, description),
		retryAfter:
			status === statusTooManyRequests
				? parseRetryAfter(response.headers.get('Retry-After'))
				: undefined,
	});
};

export { createDbApiErrorFromResponse };
