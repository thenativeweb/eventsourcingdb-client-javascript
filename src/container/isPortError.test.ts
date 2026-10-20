import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { suite, test } from 'node:test';
import { BoundPorts, getContainerRuntimeClient, ImageName } from 'testcontainers';
import { inspectContainerUntilPortsExposed } from 'testcontainers/build/generic-container/inspect-container-util-ports-exposed.js';
import { getImageTag } from '../getImageTag.js';
import { integrationTimeout } from '../testing/integrationTimeout.js';
import { isPortError } from './isPortError.js';

// The errors come from testcontainers itself, so that an update of it that
// words them differently fails these tests.
suite('isPortError', () => {
	test('recognizes the error of testcontainers if it cannot find the port on the host.', (): void => {
		assert.throws(
			(): BoundPorts =>
				BoundPorts.fromInspectResult([], {
					name: 'container',
					hostname: 'container',
					ports: { '3000/tcp': [{ hostIp: '0.0.0.0', hostPort: 50_000 }] },
					healthCheckStatus: 'none',
					networkSettings: {},
					state: { status: 'running', running: true, startedAt: new Date(), finishedAt: undefined },
					labels: {},
				}),
			(error: unknown): boolean => isPortError(error),
		);
	});

	test(
		'recognizes the error of testcontainers if the port is not published in time.',
		integrationTimeout,
		async (): Promise<void> => {
			// A container that has not started yet has no host port bound to its
			// port.
			const client = await getContainerRuntimeClient();
			const image = ImageName.fromString(`thenativeweb/eventsourcingdb:${getImageTag()}`);
			await client.image.pull(image);

			const container = await client.container.create({
				Image: image.string,
				Labels: { 'io.eventsourcingdb.client-javascript-test': randomUUID() },
				ExposedPorts: { '3000/tcp': {} },
				HostConfig: { PortBindings: { '3000/tcp': [{ HostPort: '0' }] } },
			});

			try {
				await assert.rejects(
					inspectContainerUntilPortsExposed(
						async () => await client.container.inspect(container),
						container.id,
						1,
					),
					(error: unknown): boolean => isPortError(error),
				);
			} finally {
				await client.container.remove(container, { removeVolumes: true });
			}
		},
	);

	test('does not recognize other errors.', (): void => {
		assert.equal(isPortError(new Error('No such container: container')), false);
		assert.equal(isPortError('No host port found for host IP'), false);
	});
});
