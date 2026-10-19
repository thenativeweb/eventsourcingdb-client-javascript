import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { suite, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import type { StartedTestContainer } from 'testcontainers';
import { getContainerRuntimeClient, ImageName } from 'testcontainers';
import { getImageTag } from '../getImageTag.js';
import { failPortLookups } from '../testing/failPortLookups.js';
import { integrationTimeout } from '../testing/integrationTimeout.js';
import type { ContainerInfo } from './containersOfAttempt.js';
import { startContainer } from './startContainer.js';

const startLabel = 'io.eventsourcingdb.container-start';
const testLabel = 'io.eventsourcingdb.client-javascript-test';
const markerLabel = 'io.eventsourcingdb.client-javascript-test-marker';
const exitedPrefix =
	'Failed to start the container, it exited before the database became reachable: ';

const getCommand = (port: number): string[] => [
	'run',
	'--api-token',
	'secret',
	'--data-directory-temporary',
	'--http-enabled',
	'--https-enabled=false',
	'--http-port',
	String(port),
];

// Each test labels its containers, so that it finds them, and only them, while
// other tests use the same Docker.
const listContainers = async (testId: string): Promise<ContainerInfo[]> => {
	const client = await getContainerRuntimeClient();

	return await client.container.dockerode.listContainers({
		all: true,
		filters: { label: [`${testLabel}=${testId}`] },
	});
};

// Watches Docker for the containers that it creates for a test, and returns a
// function that stops watching and returns the start label of each of them.
// Docker keeps only the latest events, so the test watches while it runs,
// instead of asking for its events afterwards. Docker passes on its events in
// order, so to stop, the test creates a container of its own and waits for its
// event, after which the events of all containers created before have arrived.
const watchCreatedContainers = async (
	testId: string,
	image: string,
): Promise<() => Promise<string[]>> => {
	const client = await getContainerRuntimeClient();
	await client.image.pull(ImageName.fromString(image));

	const events = await client.container.dockerode.getEvents({
		filters: { type: ['container'], event: ['create'], label: [`${testLabel}=${testId}`] },
	});
	if (!(events instanceof IncomingMessage)) {
		throw new Error('Failed to watch Docker.');
	}

	// Lets the test end even if it fails before it stops watching.
	events.socket.unref();

	const startIds: string[] = [];
	const markerArrived = Promise.withResolvers<void>();
	let pending = '';
	events.on('data', (chunk: Buffer): void => {
		const lines = `${pending}${chunk.toString('utf8')}`.split('\n');
		pending = lines.pop() ?? '';

		for (const line of lines.filter(candidate => candidate !== '')) {
			const { Attributes: attributes } = JSON.parse(line).Actor;
			if (attributes[markerLabel] === testId) {
				markerArrived.resolve();
			} else {
				startIds.push(attributes[startLabel]);
			}
		}
	});

	return async (): Promise<string[]> => {
		const marker = await client.container.create({
			Image: ImageName.fromString(image).string,
			Labels: { [testLabel]: testId, [markerLabel]: testId },
		});

		try {
			await markerArrived.promise;
		} finally {
			events.destroy();
			await client.container.remove(marker, { removeVolumes: true });
		}

		return startIds;
	};
};

suite('startContainer', () => {
	const image = `thenativeweb/eventsourcingdb:${getImageTag()}`;

	test(
		'replaces a running container whose database does not become reachable, up to 3 containers, and removes each of them.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId, image);

			// The database listens on another port than the one that is mapped.
			await assert.rejects(
				startContainer({
					image,
					port: 3000,
					command: getCommand(3001),
					contents: [],
					startupTimeout: 1500,
					labels: { [testLabel]: testId },
				}),
				{
					message:
						'Failed to start the container, the database did not become reachable within 1.5s in any of 3 containers',
				},
			);

			const startIds = await stopWatching();
			assert.equal(startIds.length, 3);
			assert.equal(new Set(startIds).size, 3);
			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'removes a container whose creation outlasts the startup timeout.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId, image);

			await assert.rejects(
				startContainer({
					image,
					port: 3000,
					command: getCommand(3000),
					contents: [],
					startupTimeout: 1,
					labels: { [testLabel]: testId },
				}),
				{
					message:
						'Failed to start the container, the database did not become reachable within 0.001s in any of 3 containers',
				},
			);

			assert.equal((await stopWatching()).length, 3);
			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'fails at once with the end of the log if the container exits, and removes it.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId, image);

			await assert.rejects(
				startContainer({
					image,
					port: 3000,
					command: [...getCommand(3000), '--no-such-flag'],
					contents: [],
					startupTimeout: 20_000,
					labels: { [testLabel]: testId },
				}),
				(error: unknown): boolean => {
					assert.ok(error instanceof Error);
					assert.ok(error.message.startsWith(exitedPrefix));

					// The database prints its usage, which ends with this flag, and more
					// than 20 lines in all. Docker interleaves stdout and stderr in the
					// order in which they arrive, and its log may still lack the last
					// line, so the test does not rely on which line comes last.
					const logLines = error.message.slice(exitedPrefix.length).split('\n');
					assert.ok(logLines.length <= 20);
					assert.ok(logLines.some(line => line.includes('--with-ui')));
					return true;
				},
			);

			assert.equal((await stopWatching()).length, 1);
			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'fails at once with the error of Docker if the image does not exist.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId, image);

			await assert.rejects(
				startContainer({
					image: `thenativeweb/eventsourcingdb:non-existent-${testId}`,
					port: 3000,
					command: getCommand(3000),
					contents: [],
					startupTimeout: 20_000,
					labels: { [testLabel]: testId },
				}),
				(error: unknown): boolean => {
					assert.ok(error instanceof Error);
					assert.ok(error.cause instanceof Error);
					assert.equal(error.message, `Failed to start the container: ${error.cause.message}`);
					return true;
				},
			);

			assert.equal((await stopWatching()).length, 0);
			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'fails at once with the error of Docker if Docker fails after creating the container, and removes it.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId, image);

			// Docker cannot copy a file into another file.
			await assert.rejects(
				startContainer({
					image,
					port: 3000,
					command: getCommand(3000),
					contents: [{ content: 'content', target: '/bin/busybox/file' }],
					startupTimeout: 20_000,
					labels: { [testLabel]: testId },
				}),
				(error: unknown): boolean => {
					assert.ok(error instanceof Error);
					assert.ok(error.cause instanceof Error);
					assert.equal(error.message, `Failed to start the container: ${error.cause.message}`);
					return true;
				},
			);

			assert.equal((await stopWatching()).length, 1);
			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'replaces a running container whose port testcontainers cannot find, and removes it.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const endFailing = await failPortLookups(1);
			const stopWatching = await watchCreatedContainers(testId, image);

			let container: StartedTestContainer;
			try {
				container = await startContainer({
					image,
					port: 3000,
					command: getCommand(3000),
					contents: [],
					startupTimeout: 20_000,
					labels: { [testLabel]: testId },
				});
			} finally {
				endFailing();
			}

			try {
				const startIds = await stopWatching();
				assert.equal(startIds.length, 2);
				assert.equal(new Set(startIds).size, 2);
				assert.equal((await listContainers(testId)).length, 1);
			} finally {
				await container.stop();
			}

			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'removes a container that testcontainers creates after the startup timeout, and gives up on.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();

			// The time runs out before Docker has created the container, and the
			// lookup of the port fails, so testcontainers gives up on the container
			// without removing it.
			const endFailing = await failPortLookups(Number.POSITIVE_INFINITY);
			const stopWatching = await watchCreatedContainers(testId, image);

			try {
				await assert.rejects(
					startContainer({
						image,
						port: 3000,
						command: getCommand(3000),
						contents: [],
						startupTimeout: 1,
						labels: { [testLabel]: testId },
					}),
					{
						message:
							'Failed to start the container, the database did not become reachable within 0.001s in any of 3 containers',
					},
				);
			} finally {
				endFailing();
			}

			assert.equal((await stopWatching()).length, 3);
			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'does not count pulling the image towards the startup timeout.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const client = await getContainerRuntimeClient();
			const { image: imageClient } = client;
			const { pull } = imageClient;
			let pullCount = 0;

			// The first pull takes longer than the startup timeout, the others are
			// as fast as Docker.
			imageClient.pull = async (...parameters: Parameters<typeof pull>): Promise<void> => {
				pullCount += 1;
				if (pullCount === 1) {
					await sleep(6000);
				}
				await pull.apply(imageClient, parameters);
			};

			const stopWatching = await watchCreatedContainers(testId, image);

			let container: StartedTestContainer;
			try {
				container = await startContainer({
					image,
					port: 3000,
					command: getCommand(3000),
					contents: [],
					startupTimeout: 5000,
					labels: { [testLabel]: testId },
				});
			} finally {
				imageClient.pull = pull;
			}

			try {
				assert.ok(pullCount >= 1);

				// Had the pull counted, the first attempt would have created its
				// container late, and another attempt one more.
				assert.equal((await stopWatching()).length, 1);
			} finally {
				await container.stop();
			}

			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'removes a container that Docker creates only after the wait for it has ended, without waiting for it.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const client = await getContainerRuntimeClient();
			const { container: containerClient } = client;
			const { create } = containerClient;
			const creations: Promise<unknown>[] = [];
			const backgroundRemovals: Promise<void>[] = [];

			// Docker creates no container until the test lets it, and
			// testcontainers gives up on a container without removing it, since the
			// lookup of its port fails.
			const letDockerCreate = Promise.withResolvers<void>();
			containerClient.create = async (
				...parameters: Parameters<typeof create>
			): ReturnType<typeof create> => {
				const creation = letDockerCreate.promise.then(
					async (): ReturnType<typeof create> => await create.apply(containerClient, parameters),
				);
				creations.push(creation);
				return await creation;
			};
			const endFailing = await failPortLookups(Number.POSITIVE_INFINITY);

			try {
				// The attempts give up on the creations, which are still pending,
				// once the settle timeout has run out.
				await assert.rejects(
					startContainer({
						image,
						port: 3000,
						command: getCommand(3000),
						contents: [],
						startupTimeout: 100,
						labels: { [testLabel]: testId },
						settleTimeout: 300,
						onBackgroundRemoval: (removal: Promise<void>): void => {
							backgroundRemovals.push(removal);
						},
					}),
					{
						message:
							'Failed to start the container, the database did not become reachable within 0.1s in any of 3 containers',
					},
				);
				assert.equal(creations.length, 3);
				assert.equal(backgroundRemovals.length, 3);

				letDockerCreate.resolve();
				await Promise.all([...creations, ...backgroundRemovals]);

				assert.deepEqual(await listContainers(testId), []);
			} finally {
				letDockerCreate.resolve();
				endFailing();
				containerClient.create = create;
			}
		},
	);

	test(
		'reports a failed removal after the error of the start, and goes on with the next attempt.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const client = await getContainerRuntimeClient();
			const { dockerode } = client.container;
			const { getContainer } = dockerode;

			dockerode.getContainer = (
				...parameters: Parameters<typeof getContainer>
			): ReturnType<typeof getContainer> =>
				Object.assign(getContainer.apply(dockerode, parameters), {
					remove: async (): Promise<never> => {
						await Promise.resolve();
						throw new Error('removal failed');
					},
				});
			const endFailing = await failPortLookups(Number.POSITIVE_INFINITY);
			const stopWatching = await watchCreatedContainers(testId, image);

			try {
				await assert.rejects(
					startContainer({
						image,
						port: 3000,
						command: getCommand(3000),
						contents: [],
						startupTimeout: 20_000,
						labels: { [testLabel]: testId },
					}),
					(error: unknown): boolean => {
						assert.ok(error instanceof Error);

						const [message, ...removalFailures] = error.message.split('\n');
						assert.equal(
							message,
							'Failed to start the container, the database did not become reachable within 20s in any of 3 containers',
						);
						assert.ok(removalFailures.length > 0);
						for (const removalFailure of removalFailures) {
							assert.equal(removalFailure, 'Failed to remove a container: removal failed');
						}
						return true;
					},
				);
			} finally {
				endFailing();
				dockerode.getContainer = getContainer;
			}

			try {
				assert.equal((await stopWatching()).length, 3);
			} finally {
				for (const { Id: id } of await listContainers(testId)) {
					// biome-ignore lint/performance/noAwaitInLoops: The test removes its containers one after another.
					await dockerode.getContainer(id).remove({ force: true, v: true });
				}
			}

			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'says so if the log of a container that exits is not available.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const client = await getContainerRuntimeClient();
			const { container: containerClient } = client;
			const { logs } = containerClient;

			// testcontainers ends the log without an error if Docker fails to read
			// it.
			containerClient.logs = async (): Promise<Readable> =>
				await Promise.resolve(Readable.from([]));

			try {
				await assert.rejects(
					startContainer({
						image,
						port: 3000,
						command: [...getCommand(3000), '--no-such-flag'],
						contents: [],
						startupTimeout: 20_000,
						labels: { [testLabel]: testId },
					}),
					{
						message:
							'Failed to start the container, it exited before the database became reachable: no log available',
					},
				);
			} finally {
				containerClient.logs = logs;
			}

			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'starts a container whose database becomes reachable.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId, image);

			const container = await startContainer({
				image,
				port: 3000,
				command: getCommand(3000),
				contents: [],
				startupTimeout: 20_000,
				labels: { [testLabel]: testId },
			});

			try {
				const response = await fetch(
					`http://${container.getHost()}:${container.getMappedPort(3000)}/api/v1/ping`,
				);
				assert.equal(response.status, 200);
				await response.body?.cancel();

				assert.equal((await stopWatching()).length, 1);
			} finally {
				await container.stop();
			}

			assert.deepEqual(await listContainers(testId), []);
		},
	);
});
