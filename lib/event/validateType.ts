const typePattern = /^[0-9A-Za-z_-]{2,}\.(?:[0-9A-Za-z_-]+\.)+[0-9A-Za-z_-]+$/u;

const validateType = function (type: string): void {
	const didMatch = typePattern.test(type);

	if (!didMatch) {
		throw new Error(`Malformed event type '${type}', must be reverse domain name.`);
	}
};

export { validateType };
