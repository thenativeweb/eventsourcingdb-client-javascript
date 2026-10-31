import { scanJsonItems, scanJsonValue, skipJsonWhitespace } from './scanJson.js';

// Returns the elements of a JSON array exactly as the text contains them, or
// an empty array if the text is not an array.
const getRawJsonElements = (text: string): string[] => {
	const elements: string[] = [];
	const start = skipJsonWhitespace(text, 0);

	if (text[start] !== '[') {
		return elements;
	}

	scanJsonItems(text, start, elementStart => {
		const elementEnd = scanJsonValue(text, elementStart);
		elements.push(text.slice(elementStart, elementEnd));

		return elementEnd;
	});

	return elements;
};

export { getRawJsonElements };
