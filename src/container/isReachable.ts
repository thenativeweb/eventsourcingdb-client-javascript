import { isV2NotOffered } from '../v2/isV2NotOffered.js';

const pingTimeout = 1000;
const statusOk = 200;

// Pings the database at the path, within its own time, and returns the answer
// without its body.
const ping = async (url: URL, path: string, signal: AbortSignal): Promise<Response> => {
	const response = await fetch(new URL(path, url), {
		signal: AbortSignal.any([signal, AbortSignal.timeout(pingTimeout)]),
	});
	await response.body?.cancel();

	return response;
};

// Pings the database through the v2 API, and through the v1 API only if the
// server answers that ping as one without the v2 API does, so that a server is
// reachable whichever of the two APIs it offers. Only the status 200 counts,
// not any other status of success.
const isReachable = async (url: URL, signal: AbortSignal): Promise<boolean> => {
	try {
		const v2Response = await ping(url, '/api/v2/system/ping', signal);
		if (!isV2NotOffered(v2Response)) {
			return v2Response.status === statusOk;
		}

		return (await ping(url, '/api/v1/ping', signal)).status === statusOk;
	} catch {
		// While the database starts, a ping fails, for example since nothing
		// listens on the port yet, so this is no error, but a reason to ask again.
		return false;
	}
};

export { isReachable, pingTimeout };
