import { InternalError } from './InternalError';

const wrapError = async function <TReturn = void>(
	fn: () => TReturn | Promise<TReturn>,
	onError: (error: Error) => void | Promise<void>,
): Promise<TReturn> {
	try {
		return await fn();
	} catch (ex: unknown) {
		if (ex instanceof Error) {
			await onError(ex);
		}

		throw await new InternalError(ex);
	}
};

export { wrapError };
