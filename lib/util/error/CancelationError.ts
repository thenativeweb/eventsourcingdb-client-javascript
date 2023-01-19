class CancellationError extends Error {
	public constructor(message?: string) {
		if (message === undefined) {
			super('Operation was canceled.');
		}

		super(`Operation was canceled: ${message}.`);
	}

	public toString(): string {
		return `CancellationError: ${this.message}`;
	}
}

export { CancellationError };
