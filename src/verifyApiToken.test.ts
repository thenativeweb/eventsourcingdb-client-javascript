import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { Container } from './Container.js';
import { DbApiError } from './DbApiError.js';
import { getImageTag } from './getImageTag.js';
import { containerStartTimeout } from './testing/containerStartTimeout.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

suite('verifyApiToken', () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
		await container.start();
	}, containerStartTimeout);

	afterEach(async () => {
		await container.stop();
	}, integrationTimeout);

	test(
		'does not throw an error if the token is valid.',
		integrationTimeout,
		async (): Promise<void> => {
			const client = container.getClient();

			// Should not throw.
			await client.verifyApiToken();
		},
	);

	test('throws an error if the token is invalid.', integrationTimeout, async (): Promise<void> => {
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
