import { StringDecoder } from 'string_decoder';

class LinesDecoder {
	#textBuffer: string;
	#decoder: StringDecoder;

	public constructor(encoding?: BufferEncoding) {
		this.#textBuffer = '';
		this.#decoder = new StringDecoder(encoding);
	}

	public write(chunk: Buffer): string[] {
		this.#textBuffer += this.#decoder.write(chunk);

		const lines: string[] = [];

		let lineStart = 0;
		for (let charIndex = 0; charIndex < this.#textBuffer.length; charIndex++) {
			const char = this.#textBuffer[charIndex];

			if (char !== '\n') {
				continue;
			}

			const line = this.#textBuffer.slice(lineStart, charIndex);
			lineStart = charIndex + 1;

			lines.push(line);
		}
		this.#textBuffer = this.#textBuffer.slice(lineStart);

		return lines;
	}
}

export { LinesDecoder };
