import { isValidServerHeader } from '../isValidServerHeader.js';

// Fails unless the response comes from EventSourcingDB, which names itself in
// the Server header.
const assertEventSourcingDb = (response: Response): void => {
	if (isValidServerHeader(response)) {
		return;
	}

	const serverHeader = response.headers.get('Server');
	if (!serverHeader) {
		throw new Error('Server must be EventSourcingDB, but Server header is missing.');
	}
	throw new Error(`Server must be EventSourcingDB, got Server header: '${serverHeader}'.`);
};

export { assertEventSourcingDb };
