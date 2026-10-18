import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { ErrorCode } from './ErrorCode.js';

// The slugs of the errors that the server reports, as cmd/server/api/error.go
// of EventSourcingDB lists them, at commit 36fa8821. When the server adds a
// slug, add it here and to ErrorCode.
const slugsOfServer = [
	'subject-missing',
	'subject-malformed',
	'order-unknown',
	'event-id-missing',
	'event-id-malformed',
	'bound-type-missing',
	'bound-type-unknown',
	'range-unsatisfiable',
	'from-latest-event-incomplete',
	'if-event-is-missing-unknown',
	'selection-conflicting',
	'event-type-missing',
	'event-type-malformed',
	'event-type-unknown',
	'source-missing',
	'source-malformed',
	'data-missing',
	'traceparent-malformed',
	'tracestate-malformed',
	'tracestate-without-traceparent',
	'events-missing',
	'precondition-type-missing',
	'precondition-unknown',
	'payload-missing',
	'license-invalid',
	'capacity-exceeded',
	'event-schema-violated',
	'event-schema-unregistered',
	'event-schema-missing',
	'event-schema-malformed',
	'event-schema-not-object',
	'event-schema-already-registered',
	'last-audited-event-missing',
	'last-audited-event-mismatched',
	'last-audited-event-unknown',
	'event-hash-missing',
	'event-hash-malformed',
	'event-chain-broken',
	'last-backed-up-event-missing',
	'last-backed-up-event-mismatched',
	'last-backed-up-event-unknown',
	'store-not-empty',
	'event-hash-version-unknown',
	'backup-malformed',
	'backup-incomplete',
	'backup-format-unknown',
	'full-backup-missing',
	'backup-increment-disconnected',
	'backup-failed',
	'backup-unreadable',
	'event-too-large',
	'data-malformed',
	'query-missing',
	'query-malformed',
	'query-unevaluable',
	'query-not-boolean',
	'precondition-violated',
	'store-read-only',
	'read-only-mode-already-enabled',
	'disk-full',
	'restore-in-progress',
	'store-failed',
	'indexes-rebuilding',
	'server-shutting-down',
];

const baseUrl = 'https://docs.eventsourcingdb.io/errors/';

const byText = (left: string, right: string): number => left.localeCompare(right);

const toCamelCase = (slug: string): string =>
	slug.replaceAll(/-(?<letter>[a-z])/gu, (_match, letter: string) => letter.toUpperCase());

suite('ErrorCode', (): void => {
	test('has a code for every error that the server lists, and no other.', (): void => {
		assert.deepEqual(
			Object.values(ErrorCode).toSorted(byText),
			slugsOfServer.map(slug => `${baseUrl}${slug}`).toSorted(byText),
		);
	});

	test('names each code after its slug.', (): void => {
		const codesByName = new Map<string, string>(Object.entries(ErrorCode));

		for (const slug of slugsOfServer) {
			assert.equal(codesByName.get(toCamelCase(slug)), `${baseUrl}${slug}`);
		}
	});
});
