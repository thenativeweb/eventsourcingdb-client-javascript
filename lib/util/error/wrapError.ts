const wrapError = async function <TReturn = void>(
	fn: () => Promise<TReturn>,
	onError: (error: Error) => Promise<Error>,
): Promise<TReturn> {
	try {
		return await fn();
	} catch (ex: unknown) {
		if (ex instanceof Error) {
			throw await onError(ex);
		}

		throw await onError(new Error(`Unknown error: ${ex}.`));
	}
};

export { wrapError };
