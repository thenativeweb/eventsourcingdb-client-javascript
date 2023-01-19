import { StringDecoder } from 'string_decoder';

class LinesDecoder {
	private textBuffer: string;
	private decoder: StringDecoder;

	constructor(encoding?: BufferEncoding) {
		this.textBuffer = '';
		this.decoder = new StringDecoder(encoding);
	}

	write(chunk: Buffer): string[] {
		this.textBuffer += this.decoder.write(chunk);

		const lines: string[] = [];

		let lineStart = 0;
		for (let charIndex = 0; charIndex < this.textBuffer.length; charIndex++) {
			const char = this.textBuffer[charIndex];

			if (char !== '\n') {
				continue;
			}

			const line = this.textBuffer.slice(lineStart, charIndex);
			lineStart = charIndex + 1;

			lines.push(line);
		}
		this.textBuffer = this.textBuffer.slice(lineStart);

		return lines;
	}
}

export { LinesDecoder };
