interface StreamError {
	type: 'error';
	payload: {
		error: string;
	};
}

export { StreamError };
