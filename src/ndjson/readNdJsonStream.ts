import type { StallGuard } from '../stall/StallGuard.js';

// A line comes with its text, so that a value can be taken from it exactly as
// the server sent it.
interface NdJsonLine {
	text: string;
	value: Record<string, unknown>;
}

// biome-ignore lint/nursery/noExcessiveStatementsPerFunction: The generator holds the reader, the buffer, and the abort listener, which its finally block has to release however the stream ends.
const readNdJsonStream = async function* (
	stream: ReadableStream<Uint8Array>,
	signal: AbortSignal,
	stallGuard?: StallGuard,
): AsyncGenerator<NdJsonLine, void, void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';

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
			// The clock only runs while waiting for the next chunk, not while the
			// caller handles a line, so a slow caller does not cause a stall.
			stallGuard?.restart();

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
					stallGuard?.pause();
					yield { text: line, value: JSON.parse(line) };
				}

				index = buffer.indexOf('\n');
			}
		}
	} finally {
		stallGuard?.pause();
		signal.removeEventListener('abort', onAbort);
		await reader.cancel().catch(() => {
			// Intentionally left blank.
		});
	}
};

export type { NdJsonLine };
export { readNdJsonStream };
