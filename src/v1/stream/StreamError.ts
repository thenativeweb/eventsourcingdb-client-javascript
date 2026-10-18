interface StreamError {
	type: 'error';
	payload: {
		error: string;
	};
}

export type { StreamError };
