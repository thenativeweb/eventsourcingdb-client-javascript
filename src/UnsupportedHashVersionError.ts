class UnsupportedHashVersionError extends Error {
	public constructor(version: string) {
		super(`Hash version '${version}' is not supported.`);
		this.name = 'UnsupportedHashVersionError';
	}
}

export { UnsupportedHashVersionError };
