// Waits for a promise that other callers may share, unless the signal of this
// caller aborts first, which then rejects with its reason, while the promise
// goes on for the others.
const waitUnlessAborted = async <TResult>(
	promise: Promise<TResult>,
	signal?: AbortSignal,
): Promise<TResult> => {
	if (signal === undefined) {
		return await promise;
	}

	signal.throwIfAborted();

	const aborted = Promise.withResolvers<never>();
	const onAbort = (): void => {
		aborted.reject(signal.reason);
	};

	signal.addEventListener('abort', onAbort, { once: true });

	try {
		return await Promise.race([promise, aborted.promise]);
	} finally {
		signal.removeEventListener('abort', onAbort);
	}
};

export { waitUnlessAborted };
