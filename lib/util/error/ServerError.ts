import { CustomError } from './CustomError';

class ServerError extends CustomError {
	constructor(cause: string) {
		super(`Server error occurred: ${cause}`);
	}
}

export { ServerError };
