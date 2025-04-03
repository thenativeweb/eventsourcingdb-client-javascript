const nonNegativeIntegerMatcher = /^\d+$/u;

const IsNonNegativeInteger = (value: string): boolean => {
	return nonNegativeIntegerMatcher.test(value);
};

export { IsNonNegativeInteger };
