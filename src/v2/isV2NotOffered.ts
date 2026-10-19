const statusNotFound = 404;
const statusMethodNotAllowed = 405;

// Tells whether the server answered a request to a path of the v2 API as a
// server that does not offer the v2 API does, such as EventSourcingDB 1.2.0,
// with the status 404 or 405.
const isV2NotOffered = (response: Response): boolean =>
	response.status === statusNotFound || response.status === statusMethodNotAllowed;

export { isV2NotOffered };
