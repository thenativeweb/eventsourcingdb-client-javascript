import { CustomError } from './CustomError';

class InvalidParameterError extends CustomError {
	constructor(parameterName: string, reason: string) {
		super(`Parameter '${parameterName}' is invalid: ${reason}`);
	}
}

export { InvalidParameterError };
