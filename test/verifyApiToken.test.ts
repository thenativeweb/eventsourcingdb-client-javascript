import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { Client } from '../src/Client.js';
import { EventSourcingDb } from './docker/EventSourcingDb.js';

suite('verifyApiToken', { timeout: 5_000 }, () => {
	let eventSourcingDb: EventSourcingDb;

	before(() => {
		EventSourcingDb.build();
	});

	beforeEach(async () => {
		eventSourcingDb = await EventSourcingDb.run();
	});

	afterEach(() => {
		eventSourcingDb.kill();
	});

	test('does not throw an error if the token is valid.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		// Should not throw.
		await client.verifyApiToken();
	});

	test('throws an error if the token is invalid.', async (): Promise<void> => {
		const invalidToken = `${eventSourcingDb.apiToken}-invalid`;
		const client = new Client(new URL(`http://localhost:${eventSourcingDb.port}/`), invalidToken);

		await assert.rejects(
			async () => {
				await client.verifyApiToken();
			},
			error => {
				assert.ok(error instanceof Error);
				assert.equal(
					error.message,
					"Failed to verify API token, got HTTP status code '401', expected '200'.",
				);
				return true;
			},
		);
	});
});
