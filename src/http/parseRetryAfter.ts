const secondsRegex = /^\d+$/u;

// Returns the seconds that a Retry-After header names, or undefined if there
// is no such header or it does not name seconds.
const parseRetryAfter = (header: string | null): number | undefined => {
	if (header === null) {
		return;
	}

	const value = header.trim();
	if (!secondsRegex.test(value)) {
		return;
	}

	return Number(value);
};

export { parseRetryAfter };
