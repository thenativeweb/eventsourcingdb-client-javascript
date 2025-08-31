const isRecord = (value: unknown): value is Record<string, unknown> => {
	if (value === null) {
		return false;
	}
	if (typeof value !== 'object') {
		return false;
	}
	if (Array.isArray(value)) {
		return false;
	}

	return true;
};

export { isRecord };
