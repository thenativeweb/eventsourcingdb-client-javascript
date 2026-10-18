import { assertEventSourcingDb } from '../http/assertEventSourcingDb.js';
import { createDbApiErrorFromResponse } from '../http/createDbApiErrorFromResponse.js';
import { readResponseText } from '../stall/readResponseText.js';
import type { StallGuard } from '../stall/StallGuard.js';
import { parseV2Item } from './parseV2Item.js';
import type { V2Item } from './V2Item.js';

// Reads the single answer of a request to the v2 API.
const readV2Answer = async (
	response: Response,
	stallGuard: StallGuard,
	action: string,
): Promise<V2Item> => {
	assertEventSourcingDb(response);

	if (response.status !== 200) {
		throw await createDbApiErrorFromResponse(response, stallGuard);
	}

	const text = await readResponseText(response, stallGuard);

	return parseV2Item(JSON.parse(text), text, action);
};

export { readV2Answer };
