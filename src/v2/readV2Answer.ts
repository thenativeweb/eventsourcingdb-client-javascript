import { assertEventSourcingDb } from '../http/assertEventSourcingDb.js';
import { createDbApiErrorFromResponse } from '../http/createDbApiErrorFromResponse.js';
import { readResponseText } from '../stall/readResponseText.js';
import type { StallGuard } from '../stall/StallGuard.js';
import { isV2NotOffered } from './isV2NotOffered.js';
import { parseV2Item } from './parseV2Item.js';
import type { V2Item } from './V2Item.js';

// Reads the single answer of a request to the v2 API. A server that answers
// with 404 or 405 no longer offers the v2 API, so the client forgets which API
// the server offers, and the request fails as with any other status.
const readV2Answer = async (
	response: Response,
	stallGuard: StallGuard,
	{ action, forgetApiVersion }: { action: string; forgetApiVersion: () => void },
): Promise<V2Item> => {
	if (isV2NotOffered(response)) {
		forgetApiVersion();
	}

	assertEventSourcingDb(response);

	if (response.status !== 200) {
		throw await createDbApiErrorFromResponse(response, stallGuard);
	}

	const text = await readResponseText(response, stallGuard);

	return parseV2Item(JSON.parse(text), text, action);
};

export { readV2Answer };
