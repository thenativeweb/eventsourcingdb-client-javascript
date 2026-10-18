// The codes of the errors that the server reports. A code is the URL of the
// page that documents the error, exactly as the server sends it, so a caller
// can tell errors apart by comparing the code of a DbApiError with these.
const ErrorCode = {
	subjectMissing: 'https://docs.eventsourcingdb.io/errors/subject-missing',
	subjectMalformed: 'https://docs.eventsourcingdb.io/errors/subject-malformed',
	orderUnknown: 'https://docs.eventsourcingdb.io/errors/order-unknown',
	eventIdMissing: 'https://docs.eventsourcingdb.io/errors/event-id-missing',
	eventIdMalformed: 'https://docs.eventsourcingdb.io/errors/event-id-malformed',
	boundTypeMissing: 'https://docs.eventsourcingdb.io/errors/bound-type-missing',
	boundTypeUnknown: 'https://docs.eventsourcingdb.io/errors/bound-type-unknown',
	rangeUnsatisfiable: 'https://docs.eventsourcingdb.io/errors/range-unsatisfiable',
	fromLatestEventIncomplete: 'https://docs.eventsourcingdb.io/errors/from-latest-event-incomplete',
	ifEventIsMissingUnknown: 'https://docs.eventsourcingdb.io/errors/if-event-is-missing-unknown',
	selectionConflicting: 'https://docs.eventsourcingdb.io/errors/selection-conflicting',
	eventTypeMissing: 'https://docs.eventsourcingdb.io/errors/event-type-missing',
	eventTypeMalformed: 'https://docs.eventsourcingdb.io/errors/event-type-malformed',
	eventTypeUnknown: 'https://docs.eventsourcingdb.io/errors/event-type-unknown',
	sourceMissing: 'https://docs.eventsourcingdb.io/errors/source-missing',
	sourceMalformed: 'https://docs.eventsourcingdb.io/errors/source-malformed',
	dataMissing: 'https://docs.eventsourcingdb.io/errors/data-missing',
	traceparentMalformed: 'https://docs.eventsourcingdb.io/errors/traceparent-malformed',
	tracestateMalformed: 'https://docs.eventsourcingdb.io/errors/tracestate-malformed',
	tracestateWithoutTraceparent:
		'https://docs.eventsourcingdb.io/errors/tracestate-without-traceparent',
	eventsMissing: 'https://docs.eventsourcingdb.io/errors/events-missing',
	preconditionTypeMissing: 'https://docs.eventsourcingdb.io/errors/precondition-type-missing',
	preconditionUnknown: 'https://docs.eventsourcingdb.io/errors/precondition-unknown',
	payloadMissing: 'https://docs.eventsourcingdb.io/errors/payload-missing',
	licenseInvalid: 'https://docs.eventsourcingdb.io/errors/license-invalid',
	capacityExceeded: 'https://docs.eventsourcingdb.io/errors/capacity-exceeded',
	eventSchemaViolated: 'https://docs.eventsourcingdb.io/errors/event-schema-violated',
	eventSchemaUnregistered: 'https://docs.eventsourcingdb.io/errors/event-schema-unregistered',
	eventSchemaMissing: 'https://docs.eventsourcingdb.io/errors/event-schema-missing',
	eventSchemaMalformed: 'https://docs.eventsourcingdb.io/errors/event-schema-malformed',
	eventSchemaNotObject: 'https://docs.eventsourcingdb.io/errors/event-schema-not-object',
	eventSchemaAlreadyRegistered:
		'https://docs.eventsourcingdb.io/errors/event-schema-already-registered',
	lastAuditedEventMissing: 'https://docs.eventsourcingdb.io/errors/last-audited-event-missing',
	lastAuditedEventMismatched:
		'https://docs.eventsourcingdb.io/errors/last-audited-event-mismatched',
	lastAuditedEventUnknown: 'https://docs.eventsourcingdb.io/errors/last-audited-event-unknown',
	eventHashMissing: 'https://docs.eventsourcingdb.io/errors/event-hash-missing',
	eventHashMalformed: 'https://docs.eventsourcingdb.io/errors/event-hash-malformed',
	eventChainBroken: 'https://docs.eventsourcingdb.io/errors/event-chain-broken',
	lastBackedUpEventMissing: 'https://docs.eventsourcingdb.io/errors/last-backed-up-event-missing',
	lastBackedUpEventMismatched:
		'https://docs.eventsourcingdb.io/errors/last-backed-up-event-mismatched',
	lastBackedUpEventUnknown: 'https://docs.eventsourcingdb.io/errors/last-backed-up-event-unknown',
	storeNotEmpty: 'https://docs.eventsourcingdb.io/errors/store-not-empty',
	eventHashVersionUnknown: 'https://docs.eventsourcingdb.io/errors/event-hash-version-unknown',
	backupMalformed: 'https://docs.eventsourcingdb.io/errors/backup-malformed',
	backupIncomplete: 'https://docs.eventsourcingdb.io/errors/backup-incomplete',
	backupFormatUnknown: 'https://docs.eventsourcingdb.io/errors/backup-format-unknown',
	fullBackupMissing: 'https://docs.eventsourcingdb.io/errors/full-backup-missing',
	backupIncrementDisconnected:
		'https://docs.eventsourcingdb.io/errors/backup-increment-disconnected',
	backupFailed: 'https://docs.eventsourcingdb.io/errors/backup-failed',
	backupUnreadable: 'https://docs.eventsourcingdb.io/errors/backup-unreadable',
	eventTooLarge: 'https://docs.eventsourcingdb.io/errors/event-too-large',
	dataMalformed: 'https://docs.eventsourcingdb.io/errors/data-malformed',
	queryMissing: 'https://docs.eventsourcingdb.io/errors/query-missing',
	queryMalformed: 'https://docs.eventsourcingdb.io/errors/query-malformed',
	queryUnevaluable: 'https://docs.eventsourcingdb.io/errors/query-unevaluable',
	queryNotBoolean: 'https://docs.eventsourcingdb.io/errors/query-not-boolean',
	preconditionViolated: 'https://docs.eventsourcingdb.io/errors/precondition-violated',
	storeReadOnly: 'https://docs.eventsourcingdb.io/errors/store-read-only',
	readOnlyModeAlreadyEnabled:
		'https://docs.eventsourcingdb.io/errors/read-only-mode-already-enabled',
	diskFull: 'https://docs.eventsourcingdb.io/errors/disk-full',
	restoreInProgress: 'https://docs.eventsourcingdb.io/errors/restore-in-progress',
	storeFailed: 'https://docs.eventsourcingdb.io/errors/store-failed',
	indexesRebuilding: 'https://docs.eventsourcingdb.io/errors/indexes-rebuilding',
	serverShuttingDown: 'https://docs.eventsourcingdb.io/errors/server-shutting-down',
} as const;

type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export { ErrorCode };
