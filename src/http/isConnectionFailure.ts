import diagnosticsChannel from 'node:diagnostics_channel';

// The fetch built into Node.js publishes every error that keeps it from
// establishing a connection on this channel, before it fails each request that
// waited for the connection with that error as the cause of a TypeError. These
// are DNS errors, refused connections, timeouts while connecting, and failed
// TLS handshakes, after all of which no request has been sent.
const connectErrorChannel = 'undici:client:connectError';

const connectErrors = new WeakSet<object>();

diagnosticsChannel.subscribe(connectErrorChannel, (message: unknown): void => {
	if (typeof message !== 'object' || message === null || !('error' in message)) {
		return;
	}

	const { error } = message;
	if (typeof error === 'object' && error !== null) {
		connectErrors.add(error);
	}
});

// Tells whether a request failed since it could not establish a connection,
// so that it certainly did not reach the server.
const isConnectionFailure = (error: unknown): boolean =>
	error instanceof TypeError &&
	typeof error.cause === 'object' &&
	error.cause !== null &&
	connectErrors.has(error.cause);

export { isConnectionFailure };
