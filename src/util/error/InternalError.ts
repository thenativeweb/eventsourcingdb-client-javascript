import { CustomError } from './CustomError.js';

class InternalError extends CustomError {
	constructor(cause: unknown) {
		super(`Internal error occurred: ${cause}`);
	}
}

export { InternalError };
