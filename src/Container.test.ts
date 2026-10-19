import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { Container } from './Container.js';
import { defaultStartupTimeout } from './container/defaultStartupTimeout.js';
import { getImageTag } from './getImageTag.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

suite('Container', () => {
	test('starts with a custom port.', integrationTimeout, async (): Promise<void> => {
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

	suite('startup timeout', () => {
		test('is 30 seconds by default.', (): void => {
			assert.equal(defaultStartupTimeout, 30_000);
		});

		test('accepts a startup timeout from 1 millisecond up to the longest timer of Node.js.', (): void => {
			assert.ok(new Container().withStartupTimeout(1));
			assert.ok(new Container().withStartupTimeout(2_147_483_647));
		});

		test('throws an error if the startup timeout is out of range.', (): void => {
			for (const invalidStartupTimeout of [
				0,
				-1,
				2_147_483_648,
				Number.NaN,
				Number.POSITIVE_INFINITY,
			]) {
				assert.throws((): Container => new Container().withStartupTimeout(invalidStartupTimeout), {
					name: 'Error',
					message: `Startup timeout must be between 1 and 2147483647 milliseconds, got '${invalidStartupTimeout}'.`,
				});
			}
		});

		test(
			'gives each of 3 containers the configured time to become reachable.',
			integrationTimeout,
			async (): Promise<void> => {
				const imageTag = getImageTag();
				const container = new Container().withImageTag(imageTag).withStartupTimeout(1);

				await assert.rejects(container.start(), {
					name: 'Error',
					message:
						'Failed to start the container, the database did not become reachable within 0.001s in any of 3 containers',
				});
				assert.equal(container.isRunning(), false);
			},
		);
	});
});
