import { scanJsonString, scanJsonValue, skipJsonWhitespace } from './scanJson.js';

// Returns the value of a member of a JSON object exactly as the text contains
// it, or undefined if the text is not an object or has no such member. If the
// object has the member more than once, the last one wins, as with JSON.parse.
const getRawJsonMember = (text: string, key: string): string | undefined => {
	let position = skipJsonWhitespace(text, 0);

	if (text[position] !== '{') {
		return;
	}

	position = skipJsonWhitespace(text, position + 1);

	let rawValue: string | undefined;

	while (text[position] === '"') {
		const keyEnd = scanJsonString(text, position);
		const currentKey: unknown = JSON.parse(text.slice(position, keyEnd));

		const colon = skipJsonWhitespace(text, keyEnd);
		const valueStart = skipJsonWhitespace(text, colon + 1);
		const valueEnd = scanJsonValue(text, valueStart);

		if (currentKey === key) {
			rawValue = text.slice(valueStart, valueEnd);
		}

		position = skipJsonWhitespace(text, valueEnd);
		if (text[position] !== ',') {
			break;
		}

		position = skipJsonWhitespace(text, position + 1);
	}

	return rawValue;
};

export { getRawJsonMember };
