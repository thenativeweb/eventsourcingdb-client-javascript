import type { DbApiError } from '../DbApiError.js';

const statusServiceUnavailable = 503;
const statusInsufficientStorage = 507;

// Tells whether the v1 API refused a write before storing anything, which it
// does with a status of 4xx, 503, or 507.
const isV1Refusal = (error: DbApiError): boolean =>
	(error.status >= 400 && error.status < 500) ||
	error.status === statusServiceUnavailable ||
	error.status === statusInsufficientStorage;

export { isV1Refusal };
