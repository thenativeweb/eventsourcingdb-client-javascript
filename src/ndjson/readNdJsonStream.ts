const readNdJsonStream = async function* (
	stream: ReadableStream<Uint8Array>,
	signal: AbortSignal,
): AsyncGenerator<Record<string, unknown>, void, void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';

	const onAbort = () => {
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
		while (true) {
			if (signal.aborted) {
				break;
			}

			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });

			let index: number;
			while (true) {
				index = buffer.indexOf('\n');
				if (index === -1) {
					break;
				}

				const line = buffer.slice(0, index).trim();
				buffer = buffer.slice(index + 1);

				if (line) {
					yield JSON.parse(line);
				}
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
