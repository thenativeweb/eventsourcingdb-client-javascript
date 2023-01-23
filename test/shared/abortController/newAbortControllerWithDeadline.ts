const newAbortControllerWithDeadline = function (deadlineMilliseconds: number): AbortController {
	const abortController = new AbortController();

	setTimeout(() => {
		if (abortController.signal.aborted) {
			return;
		}

		abortController.abort();
	}, deadlineMilliseconds);

	return abortController;
};

export { newAbortControllerWithDeadline };
