const readNdJsonStream = async function* (
	stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>, void, void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });

		let index: number;
		while (true) {
			index = buffer.indexOf('\n');
			if (index < 0) {
				break;
			}

			const line = buffer.slice(0, index).trim();
			buffer = buffer.slice(index + 1);

			if (line) {
				yield JSON.parse(line);
			}
		}
	}
};

export { readNdJsonStream };
