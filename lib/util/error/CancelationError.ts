class CancellationError extends Error {
	constructor(message?: string) {
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
