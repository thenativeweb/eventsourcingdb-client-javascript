import { CustomError } from '../error/CustomError.js';

class RetryError extends CustomError {
	private readonly errors: Error[];

	public constructor() {
		super();

		this.errors = [];
	}

	public appendError(error: Error): void {
		this.errors.push(error);
	}

	public get message(): string {
		return `Failed operation with ${this.errors.length} errors:\n${this.errors.join('\n')}`;
	}
}

export { RetryError };
