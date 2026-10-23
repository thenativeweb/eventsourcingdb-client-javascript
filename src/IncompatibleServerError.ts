// A request that the server cannot handle as asked, since it does not offer
// what the request needs, as the client SDK found out again right before. The
// client SDK does not send such a request, rather than have the server handle
// it otherwise.
class IncompatibleServerError extends Error {
	public constructor() {
		super('The server does not offer the v2 API, which a recursive precondition needs.');
		this.name = 'IncompatibleServerError';
	}
}

export { IncompatibleServerError };
