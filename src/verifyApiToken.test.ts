import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { Container } from './Container.js';
import { DbApiError } from './DbApiError.js';
import { getImageTag } from './getImageTag.js';

suite('verifyApiToken', { timeout: 30_000 }, () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
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
			(error: unknown): boolean => {
				assert.ok(error instanceof DbApiError);
				assert.equal(error.status, 401);
				assert.equal(error.code, undefined);
				return true;
			},
		);
	});
});
