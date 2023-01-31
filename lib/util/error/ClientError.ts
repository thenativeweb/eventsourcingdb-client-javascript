import { CustomError } from './CustomError';

class ClientError extends CustomError {
	constructor(cause: string) {
		super(`Client error occurred: ${cause}`);
	}
}

export { ClientError };
