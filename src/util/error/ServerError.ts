import { CustomError } from './CustomError.js';

class ServerError extends CustomError {
	constructor(cause: string) {
		super(`Server error occurred: ${cause}`);
	}
}

export { ServerError };
