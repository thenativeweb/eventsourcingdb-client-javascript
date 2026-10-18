import { scanJsonValue, skipJsonWhitespace } from './scanJson.js';

// Returns the elements of a JSON array exactly as the text contains them, or
// an empty array if the text is not an array.
const getRawJsonElements = (text: string): string[] => {
	const elements: string[] = [];
	let position = skipJsonWhitespace(text, 0);

	if (text[position] !== '[') {
		return elements;
	}

	position = skipJsonWhitespace(text, position + 1);

	while (position < text.length && text[position] !== ']') {
		const elementEnd = scanJsonValue(text, position);
		elements.push(text.slice(position, elementEnd));

		position = skipJsonWhitespace(text, elementEnd);
		if (text[position] !== ',') {
			break;
		}

		position = skipJsonWhitespace(text, position + 1);
	}

	return elements;
};

export { getRawJsonElements };
