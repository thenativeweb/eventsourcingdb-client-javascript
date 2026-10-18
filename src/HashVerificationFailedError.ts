class HashVerificationFailedError extends Error {
	public constructor() {
		super('Failed to verify hash.');
		this.name = 'HashVerificationFailedError';
	}
}

export { HashVerificationFailedError };
