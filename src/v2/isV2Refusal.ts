import type { DbApiError } from '../DbApiError.js';
import { ErrorCode } from '../ErrorCode.js';

// The statuses with which the v2 API refuses a request before handling it.
const refusingStatuses = new Set([400, 401, 408, 413, 429, 503]);

// Tells whether the v2 API refused a write before storing anything. It does so
// with every error item, except for a failed store, and with some statuses.
const isV2Refusal = (error: DbApiError): boolean => {
	if (error.status === 200) {
		return error.code !== ErrorCode.storeFailed;
	}

	return refusingStatuses.has(error.status);
};

export { isV2Refusal };
