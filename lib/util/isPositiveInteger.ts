const positiveIntegerMatcher = /^\d+$/u;

const isPositiveInteger = function (value: string): boolean {
	return positiveIntegerMatcher.test(value);
};

export { isPositiveInteger };
