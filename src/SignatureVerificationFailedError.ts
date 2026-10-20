class SignatureVerificationFailedError extends Error {
	public constructor() {
		super('Signature verification failed.');
		this.name = 'SignatureVerificationFailedError';
	}
}

export { SignatureVerificationFailedError };
