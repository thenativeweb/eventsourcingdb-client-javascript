import type { DbApiError } from '../DbApiError.js';

// The statuses with which the v2 API refuses a request before handling it.
const refusingStatuses = new Set([400, 401, 408, 413, 429, 503]);

// Tells whether the v2 API refused a write before storing anything. It does so
// with every error item, which comes at the status 200, and with some statuses.
// This includes an error item with the code store-failed, which the server
// sends for every write after its store has failed, since it then refuses
// writes until it is restarted. The write during which storing fails gets the
// status 500 or a stream without its end item instead, so its outcome stays
// unknown.
const isV2Refusal = (error: DbApiError): boolean =>
	error.status === 200 || refusingStatuses.has(error.status);

export { isV2Refusal };
