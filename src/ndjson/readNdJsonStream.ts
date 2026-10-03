import { HeartbeatTimeoutError } from '../HeartbeatTimeoutError.js';

const readNdJsonStream = async function* (
	stream: ReadableStream<Uint8Array>,
	signal: AbortSignal,
	heartbeatTimeoutInMilliseconds?: number,
): AsyncGenerator<Record<string, unknown>, void, void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';

	let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
	let hasHeartbeatTimedOut = false;

	// The timer only runs while waiting for the next line, not while the caller
	// handles a line, so a slow caller does not cause a heartbeat timeout.
	const startHeartbeatTimer = (): void => {
		if (heartbeatTimeoutInMilliseconds === undefined || heartbeatTimer !== undefined) {
			return;
		}

		heartbeatTimer = setTimeout(() => {
			hasHeartbeatTimedOut = true;
			reader.cancel().catch(() => {
				// Intentionally left blank.
			});
		}, heartbeatTimeoutInMilliseconds);
	};

	const stopHeartbeatTimer = (): void => {
		clearTimeout(heartbeatTimer);
		heartbeatTimer = undefined;
	};

	const onAbort = (): void => {
		reader.cancel().catch(() => {
			// Intentionally left blank.
		});
	};

	if (signal.aborted) {
		await reader.cancel().catch(() => {
			// Intentionally left blank.
		});
		return;
	}

	signal.addEventListener('abort', onAbort);

	try {
		while (!signal.aborted) {
			startHeartbeatTimer();

			// biome-ignore lint/performance/noAwaitInLoops: Awaiting the result is fine here, although we are in a loop.
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });

			let index = buffer.indexOf('\n');
			while (index !== -1) {
				const line = buffer.slice(0, index).trim();
				buffer = buffer.slice(index + 1);

				if (line) {
					stopHeartbeatTimer();
					yield JSON.parse(line);
				}

				index = buffer.indexOf('\n');
			}
		}

		if (hasHeartbeatTimedOut) {
			throw new HeartbeatTimeoutError();
		}
	} finally {
		stopHeartbeatTimer();
		signal.removeEventListener('abort', onAbort);
		await reader.cancel().catch(() => {
			// Intentionally left blank.
		});
	}
};

export { readNdJsonStream };
