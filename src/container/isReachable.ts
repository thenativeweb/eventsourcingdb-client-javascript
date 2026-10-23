const pingTimeout = 1000;
const statusOk = 200;
const statusNotFound = 404;
const statusMethodNotAllowed = 405;

// A server without the v2 API answers its paths with one of these.
const statusesWithoutV2Api = new Set([statusNotFound, statusMethodNotAllowed]);

// Pings the database at the path, within its own time, and returns the status
// of the answer.
const ping = async (url: URL, path: string, signal: AbortSignal): Promise<number> => {
	const response = await fetch(new URL(path, url), {
		signal: AbortSignal.any([signal, AbortSignal.timeout(pingTimeout)]),
	});
	await response.body?.cancel();

	return response.status;
};

// Pings the database through the v2 API, and through the v1 API only if the
// server answers that ping as one without the v2 API does, so that a server is
// reachable whichever of the two APIs it offers. Only the status 200 counts,
// not any other status of success.
const isReachable = async (url: URL, signal: AbortSignal): Promise<boolean> => {
	try {
		const v2Status = await ping(url, '/api/v2/system/ping', signal);
		if (!statusesWithoutV2Api.has(v2Status)) {
			return v2Status === statusOk;
		}

		return (await ping(url, '/api/v1/ping', signal)) === statusOk;
	} catch {
		// While the database starts, a ping fails, for example since nothing
		// listens on the port yet, so this is no error, but a reason to ask again.
		return false;
	}
};

export { isReachable, pingTimeout };
