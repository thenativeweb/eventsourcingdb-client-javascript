const isStringOrUndefined = (value: unknown): value is string | undefined => {
	if (value === undefined) {
		return true;
	}
	if (typeof value === 'string') {
		return true;
	}

	return false;
};

export { isStringOrUndefined };
