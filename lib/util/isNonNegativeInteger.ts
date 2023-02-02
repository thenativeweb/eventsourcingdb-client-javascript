const positiveIntegerMatcher = /^\d+$/u;

const IsNonNegativeInteger = function (value: string): boolean {
	return positiveIntegerMatcher.test(value);
};

export { IsNonNegativeInteger };
