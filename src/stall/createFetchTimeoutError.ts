// Creates an error like the one that the fetch built into Node.js gives as
// the cause of its TypeError when it times out, with the same name, code, and
// message, so that code that checks the code of the cause keeps working.
const createFetchTimeoutError = (phase: 'headers' | 'body'): Error => {
	if (phase === 'headers') {
		return Object.assign(new Error('Headers Timeout Error'), {
			name: 'HeadersTimeoutError',
			code: 'UND_ERR_HEADERS_TIMEOUT',
		});
	}

	return Object.assign(new Error('Body Timeout Error'), {
		name: 'BodyTimeoutError',
		code: 'UND_ERR_BODY_TIMEOUT',
	});
};

export { createFetchTimeoutError };
