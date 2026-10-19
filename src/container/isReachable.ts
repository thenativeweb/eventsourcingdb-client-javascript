const pingTimeout = 1000;
const statusOk = 200;

// Pings the database. Only the status 200 counts, not any other status of
// success.
const isReachable = async (url: URL, signal: AbortSignal): Promise<boolean> => {
	try {
		const response = await fetch(new URL('/api/v1/ping', url), {
			signal: AbortSignal.any([signal, AbortSignal.timeout(pingTimeout)]),
		});
		await response.body?.cancel();

		return response.status === statusOk;
	} catch {
		// While the database starts, a ping fails, for example since nothing
		// listens on the port yet, so this is no error, but a reason to ask again.
		return false;
	}
};

export { isReachable };
