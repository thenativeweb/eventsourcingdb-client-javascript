import { assertEventSourcingDb } from '../http/assertEventSourcingDb.js';
import { createDbApiErrorFromResponse } from '../http/createDbApiErrorFromResponse.js';
import { readNdJsonStream } from '../ndjson/readNdJsonStream.js';
import type { StallGuard } from '../stall/StallGuard.js';
import { parseV2Item } from './parseV2Item.js';
import type { V2Item } from './V2Item.js';

// Reads the items of a stream of the v2 API. It skips heartbeats and fails
// with the error of an error item. A stream that has an end closes with an
// end item, which it yields as well, so such a stream that ends before its
// end item broke off and fails, unless the caller aborted it.
const readV2Stream = async function* (
	response: Response,
	stallGuard: StallGuard,
	{ signal, action, hasEnd }: { signal?: AbortSignal; action: string; hasEnd: boolean },
): AsyncGenerator<V2Item, void, void> {
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

	if (hasEnd && !signal?.aborted) {
		throw new Error(`Failed to ${action}, since the stream ended before its end item.`);
	}
};

export { readV2Stream };
