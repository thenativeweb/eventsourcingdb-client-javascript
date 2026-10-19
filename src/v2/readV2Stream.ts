import { assertEventSourcingDb } from '../http/assertEventSourcingDb.js';
import { createDbApiErrorFromResponse } from '../http/createDbApiErrorFromResponse.js';
import { createStreamEndedError } from '../http/createStreamEndedError.js';
import { readNdJsonStream } from '../ndjson/readNdJsonStream.js';
import type { StallGuard } from '../stall/StallGuard.js';
import { isV2NotOffered } from './isV2NotOffered.js';
import { parseV2Item } from './parseV2Item.js';
import type { V2Item } from './V2Item.js';

// Reads the items of a stream of the v2 API. It skips heartbeats and fails
// with the error of an error item. A stream that has an end closes with an
// end item, which it yields as well, and a stream that has none, such as
// observing events, never ends on its own. So a stream that ends otherwise
// broke off and fails, unless the caller aborted it. A server that answers
// with 404 or 405 no longer offers the v2 API, so the client forgets which API
// the server offers, and the stream fails as with any other status.
const readV2Stream = async function* (
	response: Response,
	stallGuard: StallGuard,
	{
		signal,
		action,
		hasEnd,
		forgetApiVersion,
	}: { signal?: AbortSignal; action: string; hasEnd: boolean; forgetApiVersion: () => void },
): AsyncGenerator<V2Item, void, void> {
	if (isV2NotOffered(response)) {
		forgetApiVersion();
	}

	assertEventSourcingDb(response);

	if (response.status !== 200) {
		throw await createDbApiErrorFromResponse(response, stallGuard);
	}
	if (!response.body) {
		throw new Error(`Failed to ${action}.`);
	}

	for await (const { value, text } of readNdJsonStream(
		response.body,
		stallGuard.signal,
		stallGuard,
	)) {
		const item = parseV2Item(value, text, action);

		if (item.type === 'heartbeat') {
			continue;
		}

		yield item;

		if (hasEnd && item.type === 'end') {
			return;
		}
	}

	stallGuard.throwIfStalled();

	if (!signal?.aborted) {
		throw createStreamEndedError(action);
	}
};

export { readV2Stream };
