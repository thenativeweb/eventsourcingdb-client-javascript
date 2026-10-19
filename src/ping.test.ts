import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { Container } from './Container.js';
import { getImageTag } from './getImageTag.js';
import { containerStartTimeout } from './testing/containerStartTimeout.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

suite('ping', () => {
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
		'does not throw an error if the server is reachable.',
		integrationTimeout,
		async (): Promise<void> => {
			const client = container.getClient();

			// Should not throw.
			await client.ping();
		},
	);

	test(
		'throws an error if the server is not reachable.',
		integrationTimeout,
		async (): Promise<void> => {
			const port = container.getMappedPort();
			const apiToken = container.getApiToken();

			const client = new Client(new URL(`http://non-existent-host:${port}/`), apiToken);

			await assert.rejects(
				async () => {
					await client.ping();
				},
				error => {
					assert.ok(error instanceof Error);
					assert.equal(error.message, 'fetch failed');
					return true;
				},
			);
		},
	);
});
