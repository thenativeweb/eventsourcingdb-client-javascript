const isAbortError = (error: unknown): boolean =>
	error instanceof DOMException && error.name === 'AbortError';

export { isAbortError };
