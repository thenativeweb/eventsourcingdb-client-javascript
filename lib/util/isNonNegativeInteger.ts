const nonNegativeIntegerMatcher = /^\d+$/u;

const IsNonNegativeInteger = function (value: string): boolean {
	return nonNegativeIntegerMatcher.test(value);
};

export { IsNonNegativeInteger };
