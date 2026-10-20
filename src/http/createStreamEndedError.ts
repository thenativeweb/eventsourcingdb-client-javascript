// Creates the error for a stream that the server closed before it was done: a
// finite stream that ends before its end item, or a stream of observed events,
// which never ends on its own. Either broke off because of a failure that the
// server did not report.
const createStreamEndedError = (action: string): Error =>
	new Error(`Failed to ${action}, since the stream ended unexpectedly.`);

export { createStreamEndedError };
