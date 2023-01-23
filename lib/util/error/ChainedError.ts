class ChainedError extends Error {
	public constructor(message: string, cause: Error) {
		super(`${message} (cause: ${cause})`, { cause });
	}
}

export { ChainedError };
