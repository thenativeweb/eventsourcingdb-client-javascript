const isValidServerHeader = (response: Response): boolean => {
	const serverHeader = response.headers.get('Server');

	if (!serverHeader) {
		return false;
	}

	if (!serverHeader.startsWith('EventSourcingDB/')) {
		return false;
	}

	return true;
};

export { isValidServerHeader };
