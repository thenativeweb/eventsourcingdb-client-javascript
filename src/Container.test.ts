import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { Container } from './Container.js';
import { getImageTag } from './getImageTag.js';

suite('Container', { timeout: 30_000 }, () => {
	test('starts with a custom port.', async (): Promise<void> => {
		const imageTag = getImageTag();
		const container = new Container().withImageTag(imageTag).withPort(4000);

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
