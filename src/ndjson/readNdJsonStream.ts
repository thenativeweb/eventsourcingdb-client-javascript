const readNdJsonStream = async function* (
	stream: ReadableStream<Uint8Array>,
	signal: AbortSignal,
): AsyncGenerator<Record<string, unknown>, void, void> {
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
					yield JSON.parse(line);
				}

				index = buffer.indexOf('\n');
			}
		}
	} finally {
		signal.removeEventListener('abort', onAbort);
		await reader.cancel().catch(() => {
			// Intentionally left blank.
		});
	}
};

export { readNdJsonStream };
