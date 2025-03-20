import { ValidationError } from '../util/error/ValidationError.js';

const typePattern = /^[0-9A-Za-z_-]{2,}\.(?:[0-9A-Za-z_-]+\.)+[0-9A-Za-z_-]+$/u;

const validateType = (type: string): void => {
	const didMatch = typePattern.test(type);

	if (!didMatch) {
		throw new ValidationError(`Failed to validate type: '${type}' must be a reverse domain name.`);
	}
};

export { validateType };
