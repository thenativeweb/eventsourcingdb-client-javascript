// These functions find where a value starts and ends in a JSON text, so that
// the SDK can take a value exactly as the server sent it, byte for byte. They
// expect valid JSON, since the SDK only scans texts that JSON.parse accepted.

const isJsonWhitespace = (character: string | undefined): boolean =>
	character === ' ' || character === '\t' || character === '\n' || character === '\r';

const isJsonDelimiter = (character: string | undefined): boolean =>
	character === ',' || character === '}' || character === ']' || isJsonWhitespace(character);

const skipJsonWhitespace = (text: string, start: number): number => {
	let position = start;

	while (isJsonWhitespace(text[position])) {
		position += 1;
	}

	return position;
};

const scanJsonString = (text: string, start: number): number => {
	let position = start + 1;

	while (position < text.length) {
		const character = text[position];

		if (character === '\\') {
			position += 2;
			continue;
		}
		if (character === '"') {
			return position + 1;
		}

		position += 1;
	}

	throw new Error('Failed to scan JSON string.');
};

const scanJsonContainer = (text: string, start: number): number => {
	let depth = 0;
	let position = start;

	while (position < text.length) {
		const character = text[position];

		if (character === '"') {
			position = scanJsonString(text, position);
			continue;
		}
		if (character === '{' || character === '[') {
			depth += 1;
		}
		if (character === '}' || character === ']') {
			depth -= 1;

			if (depth === 0) {
				return position + 1;
			}
		}

		position += 1;
	}

	throw new Error('Failed to scan JSON container.');
};

// Returns the position right after the value that starts at the given position.
const scanJsonValue = (text: string, start: number): number => {
	const character = text[start];

	if (character === '"') {
		return scanJsonString(text, start);
	}
	if (character === '{' || character === '[') {
		return scanJsonContainer(text, start);
	}

	let position = start;
	while (position < text.length && !isJsonDelimiter(text[position])) {
		position += 1;
	}

	return position;
};

// Scans the items of the JSON array or object whose opening bracket is at the
// given position, the elements of an array or the members of an object, one
// after another. It passes the start of each item to the given function,
// which returns the position right after the item.
const scanJsonItems = (
	text: string,
	start: number,
	scanItem: (itemStart: number) => number,
): void => {
	let position = skipJsonWhitespace(text, start + 1);

	while (position < text.length && text[position] !== ']' && text[position] !== '}') {
		position = skipJsonWhitespace(text, scanItem(position));
		if (text[position] !== ',') {
			return;
		}

		position = skipJsonWhitespace(text, position + 1);
	}
};

export { scanJsonItems, scanJsonString, scanJsonValue, skipJsonWhitespace };
