import { AsyncLocalStorage } from 'node:async_hooks';
import diagnosticsChannel from 'node:diagnostics_channel';

// How far the request of a write got. A request is known once the fetch built
// into Node.js has created it, and sent once its headers went out. Until then
// it has not established a connection, or is still establishing one, so the
// server cannot have received it.
interface Sending {
	state: 'unknown' | 'created' | 'sent';
}

const currentSending = new AsyncLocalStorage<Sending>();
const sendingByRequest = new WeakMap<object, Sending>();

const getRequest = (message: unknown): object | undefined => {
	if (typeof message !== 'object' || message === null || !('request' in message)) {
		return;
	}

	const { request } = message;
	if (typeof request !== 'object' || request === null) {
		return;
	}

	return request;
};

// The fetch built into Node.js creates its request within the call of fetch,
// so the request belongs to the write that runs there.
diagnosticsChannel.subscribe('undici:request:create', (message: unknown): void => {
	const sending = currentSending.getStore();
	const request = getRequest(message);

	if (sending === undefined || request === undefined || sending.state !== 'unknown') {
		return;
	}

	sending.state = 'created';
	sendingByRequest.set(request, sending);
});

diagnosticsChannel.subscribe('undici:client:sendHeaders', (message: unknown): void => {
	const request = getRequest(message);
	const sending = request === undefined ? undefined : sendingByRequest.get(request);

	if (sending !== undefined) {
		sending.state = 'sent';
	}
});

// Runs a write and tells, if it fails, whether its request certainly did not
// reach the server, since it was created but its headers never went out. If
// the client cannot tell, for example since fetch is not the one built into
// Node.js, the request counts as sent.
const trackSending = async <TResult>(
	write: () => Promise<TResult>,
): Promise<{ result: TResult } | { error: unknown; hasBeenSent: boolean }> => {
	const sending: Sending = { state: 'unknown' };

	try {
		return { result: await currentSending.run(sending, write) };
	} catch (error) {
		return { error, hasBeenSent: sending.state !== 'created' };
	}
};

export { trackSending };
