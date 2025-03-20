import { CustomError } from './CustomError.js';

class ClientError extends CustomError {
	constructor(cause: string) {
		super(`Client error occurred: ${cause}`);
	}
}

export { ClientError };
