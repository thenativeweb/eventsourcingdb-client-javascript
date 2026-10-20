// A write that failed once it may have reached the server, so it may have been
// stored nonetheless. Its cause tells what went wrong.
class OutcomeUnknownError extends Error {
	public constructor({ cause }: { cause: unknown }) {
		super('The write may or may not have been stored.', { cause });
		this.name = 'OutcomeUnknownError';
	}
}

export { OutcomeUnknownError };
