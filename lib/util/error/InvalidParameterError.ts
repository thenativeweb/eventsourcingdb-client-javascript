import { CustomError } from './CustomError.js';

class InvalidParameterError extends CustomError {
	constructor(parameterName: string, reason: string) {
		super(`Parameter '${parameterName}' is invalid: ${reason}`);
	}
}

export { InvalidParameterError };
