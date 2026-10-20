interface DbApiErrorOptions {
	status: number;
	description: string;
	code?: string;
	details?: Record<string, unknown>;
	retryAfter?: number;
}

// An error that the server reports, whether as an error item of the v2 API, as
// a status other than 200 with a text, or as an error of the v1 API.
class DbApiError extends Error {
	// The URL that names the error, exactly as the server sends it, which the
	// constants of ErrorCode hold. It is undefined for an error without a code.
	public readonly code: string | undefined;
	public readonly description: string;
	public readonly details: Record<string, unknown>;

	// The HTTP status of the response, which is 200 for an error item.
	public readonly status: number;

	// The seconds after which the server accepts requests again, which only a
	// response with the status 429 may name.
	public readonly retryAfter: number | undefined;

	public constructor({ status, description, code, details = {}, retryAfter }: DbApiErrorOptions) {
		super(
			description === '' ? `The server answered with HTTP status code '${status}'.` : description,
		);
		this.name = 'DbApiError';
		this.code = code;
		this.description = description;
		this.details = details;
		this.status = status;
		this.retryAfter = retryAfter;
	}
}

export type { DbApiErrorOptions };
export { DbApiError };
