import type { StallGuard } from './StallGuard.js';

// Reads the body of a response as text, like response.text(), but restarts
// the clock of the stall guard with every chunk that arrives.
const readResponseText = async (response: Response, stallGuard: StallGuard): Promise<string> => {
	if (!response.body) {
		return '';
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder('utf-8');
	let text = '';

	try {
		stallGuard.restart();
		let result = await reader.read();

		while (!result.done) {
			text += decoder.decode(result.value, { stream: true });

			stallGuard.restart();
			// biome-ignore lint/performance/noAwaitInLoops: Awaiting the result is fine here, although we are in a loop.
			result = await reader.read();
		}

		text += decoder.decode();
	} finally {
		reader.releaseLock();
	}

	return text;
};

export { readResponseText };
