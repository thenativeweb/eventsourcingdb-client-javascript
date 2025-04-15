import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { EventSourcingDbContainer } from './EventSourcingDbContainer.js';

suite('verifyApiToken', { timeout: 30_000 }, () => {
	let container: EventSourcingDbContainer;

	beforeEach(async () => {
		container = new EventSourcingDbContainer();
		await container.start();
	});

	afterEach(async () => {
		await container.stop();
	});

	test('does not throw an error if the token is valid.', async (): Promise<void> => {
		const client = container.getClient();

		// Should not throw.
		await client.verifyApiToken();
	});

	test('throws an error if the token is invalid.', async (): Promise<void> => {
		const url = container.getBaseUrl();
		const invalidApiToken = `${container.getApiToken()}-invalid`;

		const client = new Client(url, invalidApiToken);

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
