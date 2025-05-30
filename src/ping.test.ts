import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { Container } from './Container.js';
import { getImageVersionFromDockerfile } from './getImageVersionFromDockerfile.js';

suite('ping', { timeout: 30_000 }, () => {
	let container: Container;

	beforeEach(async () => {
		const imageVersion = getImageVersionFromDockerfile();
		container = new Container().withImageTag(imageVersion);
		await container.start();
	});

	afterEach(async () => {
		await container.stop();
	});

	test('does not throw an error if the server is reachable.', async (): Promise<void> => {
		const client = container.getClient();

		// Should not throw.
		await client.ping();
	});

	test('throws an error if the server is not reachable.', async (): Promise<void> => {
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
	});
});
