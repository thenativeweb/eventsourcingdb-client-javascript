import { InternalError } from './InternalError';

const isPromise = function (value: unknown): value is Promise<unknown> {
	return typeof value === 'object' && typeof (value as Record<string, unknown>).then === 'function';
};

function wrapError<TReturn = void>(fn: () => TReturn, onError: (error: Error) => void): TReturn;
function wrapError<TReturn = void>(
	fn: () => Promise<TReturn>,
	onError: (error: Error) => Promise<void>,
): Promise<TReturn>;
function wrapError<TReturn = void>(
	fn: () => TReturn | Promise<TReturn>,
	onError: (error: Error) => void | Promise<void>,
): TReturn | Promise<TReturn> {
	try {
		const invocationResult = fn();

		if (isPromise(invocationResult)) {
			return invocationResult.catch((ex: unknown) => {
				let err: Error;

				if (ex instanceof Error) {
					err = ex;
				} else {
					err = new InternalError(ex);
				}

				try {
					const onErrorInvocationResult = onError(err);

					if (isPromise(onErrorInvocationResult)) {
						return onErrorInvocationResult
							.then(() => {
								return Promise.reject(new InternalError('onError did not throw.'));
							})
							.catch((newEx: unknown): Promise<TReturn> => {
								let newErr: Error;

								if (newEx instanceof Error) {
									newErr = newEx;
								} else {
									newErr = new InternalError(newEx);
								}

								return Promise.reject(newErr);
							});
					}

					return Promise.reject(err);
				} catch (newEx: unknown) {
					let newErr: Error;

					if (newEx instanceof Error) {
						newErr = newEx;
					} else {
						newErr = new InternalError(newEx);
					}

					return Promise.reject(newErr);
				}
			});
		}

		return invocationResult;
	} catch (ex: unknown) {
		if (ex instanceof Error) {
			onError(ex);
		}

		throw new InternalError(ex);
	}
}

export { wrapError };
