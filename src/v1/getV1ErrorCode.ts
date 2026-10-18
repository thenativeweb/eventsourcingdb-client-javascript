import { ErrorCode } from '../ErrorCode.js';
import type { Transport } from '../Transport.js';

const statusNotFound = 404;
const statusConflict = 409;
const statusServiceUnavailable = 503;
const statusInsufficientStorage = 507;

// Assigns the code of the v2 API to those errors of the v1 API that clearly
// match one, by the status and the text that EventSourcingDB 1.2.0 sends for
// them. Every other error of the v1 API has no code. Of the conflicts that
// writing events reports as a state conflict, only a failed precondition is
// one, since the other is an exceeded capacity of the store.
const getV1ErrorCode = (
	call: keyof Transport,
	status: number,
	description: string,
): string | undefined => {
	if (
		status === statusServiceUnavailable &&
		description.startsWith('the current operation mode conflicts with the given request')
	) {
		return ErrorCode.storeReadOnly;
	}

	if (call === 'writeEvents') {
		if (
			status === statusConflict &&
			description.startsWith('state conflict: precondition failed')
		) {
			return ErrorCode.preconditionViolated;
		}
		if (status === statusConflict && description.startsWith('schema conflict')) {
			return ErrorCode.eventSchemaViolated;
		}
		if (status === statusInsufficientStorage) {
			return ErrorCode.licenseInvalid;
		}
	}

	if (
		call === 'registerEventSchema' &&
		status === statusConflict &&
		description === 'schema conflict: schema already exists'
	) {
		return ErrorCode.eventSchemaAlreadyRegistered;
	}

	if (call === 'readEventType' && status === statusNotFound) {
		return ErrorCode.eventTypeUnknown;
	}
};

export { getV1ErrorCode };
