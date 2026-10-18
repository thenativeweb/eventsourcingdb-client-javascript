import { ConnectionStalledError } from '../ConnectionStalledError.js';

// Ends a request once nothing arrives from the server for the stall timeout,
// from sending the request until its end, including connecting and waiting
// for the response headers. Everything that arrives restarts the clock, and
// the clock stops while the caller handles an item of a stream. Aborting the
// signal of the caller aborts the request as well.
class StallGuard {
	readonly #stallTimeout: number;
	readonly #controller = new AbortController();
	readonly #callerSignal: AbortSignal | undefined;
	#createStallError: () => Error;
	#stallError: Error | undefined;
	#timer: ReturnType<typeof setTimeout> | undefined;

	readonly #onCallerAbort = (): void => {
		this.#controller.abort(this.#callerSignal?.reason);
	};

	public constructor(stallTimeout: number, callerSignal?: AbortSignal) {
		this.#stallTimeout = stallTimeout;
		this.#callerSignal = callerSignal;
		this.#createStallError = (): Error => new ConnectionStalledError(stallTimeout);

		if (callerSignal?.aborted) {
			this.#onCallerAbort();
		} else {
			callerSignal?.addEventListener('abort', this.#onCallerAbort, { once: true });
		}
	}

	// The signal to hand to fetch, which aborts once the request stalls or the
	// caller aborts.
	public get signal(): AbortSignal {
		return this.#controller.signal;
	}

	// From now on, a stall ends the request with the error that this creates.
	public onStall(createStallError: () => Error): void {
		this.#createStallError = createStallError;
	}

	// Starts the clock, or starts it anew, since something arrived.
	public restart(): void {
		if (this.#controller.signal.aborted) {
			return;
		}

		if (this.#timer !== undefined) {
			this.#timer.refresh();
			return;
		}

		this.#timer = setTimeout(() => {
			this.#timer = undefined;
			this.#stallError = this.#createStallError();
			this.#controller.abort(this.#stallError);
		}, this.#stallTimeout);
	}

	// Stops the clock, while the caller handles an item of a stream.
	public pause(): void {
		clearTimeout(this.#timer);
		this.#timer = undefined;
	}

	public throwIfStalled(): void {
		if (this.#stallError !== undefined) {
			throw this.#stallError;
		}
	}

	// Stops watching the request. Aborting it as well closes its connection,
	// which a stream needs, since it may end before its body does.
	public dispose({ abortRequest }: { abortRequest: boolean }): void {
		this.pause();
		this.#callerSignal?.removeEventListener('abort', this.#onCallerAbort);

		if (abortRequest) {
			this.#controller.abort();
		}
	}
}

export { StallGuard };
