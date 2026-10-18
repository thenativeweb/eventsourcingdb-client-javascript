import { ErrorCode } from '../ErrorCode.js';
import type { Transport } from '../Transport.js';

interface Mapping {
	// The call that the error belongs to, or undefined for every call.
	call: keyof Transport | undefined;
	status: number;

	// The start of the text that EventSourcingDB 1.2.0 sends for the error.
	text: string;
	code: ErrorCode;
}

// The errors of the v1 API that clearly match a code of the v2 API, by the
// status and the text that EventSourcingDB 1.2.0 sends for them.
const mappings: Mapping[] = [
	{
		call: 'writeEvents',
		status: 409,
		text: 'state conflict: precondition failed',
		code: ErrorCode.preconditionViolated,
	},
	{
		call: 'writeEvents',
		status: 409,
		text: 'state conflict: exceeded max store capacity',
		code: ErrorCode.capacityExceeded,
	},
	{
		call: 'writeEvents',
		status: 409,
		text: 'schema conflict: event candidate does not match schema',
		code: ErrorCode.eventSchemaViolated,
	},
	{
		call: 'registerEventSchema',
		status: 409,
		text: 'schema conflict: schema already exists',
		code: ErrorCode.eventSchemaAlreadyRegistered,
	},
	{
		call: 'registerEventSchema',
		status: 409,
		text: 'schema conflict: event with ID',
		code: ErrorCode.eventSchemaViolated,
	},
	{
		call: 'readEvents',
		status: 409,
		text: 'state conflict: fromLatestEvent results in an event ID greater than upperBound ID',
		code: ErrorCode.rangeUnsatisfiable,
	},
	{
		call: 'readEventType',
		status: 404,
		text: '',
		code: ErrorCode.eventTypeUnknown,
	},
	{
		call: undefined,
		status: 503,
		text: 'the current operation mode conflicts with the given request',
		code: ErrorCode.storeReadOnly,
	},
	{
		call: 'writeEvents',
		status: 507,
		text: '',
		code: ErrorCode.licenseInvalid,
	},
];

// Assigns the code of the v2 API to an error of the v1 API that clearly
// matches one. Every other error of the v1 API has no code.
const getV1ErrorCode = (
	call: keyof Transport,
	status: number,
	description: string,
): ErrorCode | undefined =>
	mappings.find(
		mapping =>
			(mapping.call === undefined || mapping.call === call) &&
			mapping.status === status &&
			description.startsWith(mapping.text),
	)?.code;

export { getV1ErrorCode };
