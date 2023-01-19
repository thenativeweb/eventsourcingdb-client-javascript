class CancelationError extends Error {
	public constructor(message?: string) {
		if (message === undefined) {
			super('Operation was canceled.');
		}

		super(`Operation was canceled: ${message}.`);
	}

	public toString(): string {
		return `CancelationError: ${this.message}`;
	}
}

export { CancelationError };
