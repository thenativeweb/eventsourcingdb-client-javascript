import { scanJsonItems, scanJsonString, scanJsonValue, skipJsonWhitespace } from './scanJson.js';

// Returns the value of a member of a JSON object exactly as the text contains
// it, or undefined if the text is not an object or has no such member. If the
// object has the member more than once, the last one wins, as with JSON.parse.
const getRawJsonMember = (text: string, key: string): string | undefined => {
	const start = skipJsonWhitespace(text, 0);

	if (text[start] !== '{') {
		return;
	}

	let rawValue: string | undefined;

	scanJsonItems(text, start, memberStart => {
		const keyEnd = scanJsonString(text, memberStart);
		const currentKey: unknown = JSON.parse(text.slice(memberStart, keyEnd));

		const colon = skipJsonWhitespace(text, keyEnd);
		const valueStart = skipJsonWhitespace(text, colon + 1);
		const valueEnd = scanJsonValue(text, valueStart);

		if (currentKey === key) {
			rawValue = text.slice(valueStart, valueEnd);
		}

		return valueEnd;
	});

	return rawValue;
};

export { getRawJsonMember };
