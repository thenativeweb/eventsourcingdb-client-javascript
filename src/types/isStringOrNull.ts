const isStringOrNull = (value: unknown): value is string | null => {
	if (value === null) {
		return true;
	}
	if (typeof value === 'string') {
		return true;
	}

	return false;
};

export { isStringOrNull };
