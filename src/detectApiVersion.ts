import { assertEventSourcingDb } from './http/assertEventSourcingDb.js';
import { createDbApiErrorFromResponse } from './http/createDbApiErrorFromResponse.js';
import { readResponseText } from './stall/readResponseText.js';
import { runWithStallGuard } from './stall/runWithStallGuard.js';
import { hasShapeOf } from './types/hasShapeOf.js';
import { isString } from './types/isString.js';
import { isV2NotOffered } from './v2/isV2NotOffered.js';

type ApiVersion = 'v1' | 'v2';

interface PingEnvelope {
	type: string;
	data: {
		type: string;
	};
}

// An answer that is not JSON is not a ping, so it parses as null.
const parseJson = (text: string): unknown => {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
};

// Finds out whether the server offers the v2 API, by pinging it there. A
// server that offers only the v1 API, as EventSourcingDB 1.2.0 does, answers
// a path of the v2 API with the status 404 or 405. Every other answer than
// these and a ping of the v2 API fails, so that the next request asks again.
const detectApiVersion = async ({
	url,
	stallTimeout,
}: {
	url: URL;
	stallTimeout: number;
}): Promise<ApiVersion> =>
	await runWithStallGuard({ stallTimeout }, async stallGuard => {
		const response = await stallGuard.send(new URL('/api/v2/system/ping', url).toString(), {
			method: 'GET',
		});

		if (isV2NotOffered(response)) {
			await readResponseText(response, stallGuard);
			return 'v1';
		}

		assertEventSourcingDb(response);

		if (response.status !== 200) {
			throw await createDbApiErrorFromResponse(response, stallGuard);
		}

		const responseBody = parseJson(await readResponseText(response, stallGuard));
		if (
			!hasShapeOf<PingEnvelope>(responseBody, {
				type: isString,
				data: {
					type: isString,
				},
			}) ||
			responseBody.type !== 'event' ||
			responseBody.data.type !== 'io.eventsourcingdb.api.ping-received'
		) {
			throw new Error('Failed to find out which API the server offers.');
		}

		return 'v2';
	});

export type { ApiVersion };
export { detectApiVersion };
