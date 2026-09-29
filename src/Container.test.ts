import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { Container } from './Container.js';
import { getImageVersionFromDockerfile } from './getImageVersionFromDockerfile.js';

suite('Container', { timeout: 30_000 }, () => {
	test('starts with a custom port.', async (): Promise<void> => {
		const imageVersion = getImageVersionFromDockerfile();
		const container = new Container().withImageTag(imageVersion).withPort(4000);

		await container.start();

		try {
			const client = container.getClient();

			// Should not throw.
			await client.ping();
			assert.ok(container.getMappedPort() > 0);
		} finally {
			await container.stop();
		}
	});
});
