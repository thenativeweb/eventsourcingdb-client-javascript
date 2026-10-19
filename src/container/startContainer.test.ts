import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { suite, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import type { StartedTestContainer } from 'testcontainers';
import { getContainerRuntimeClient } from 'testcontainers';
import { getImageTag } from '../getImageTag.js';
import { failPortLookups } from '../testing/failPortLookups.js';
import { integrationTimeout } from '../testing/integrationTimeout.js';
import { startContainer } from './startContainer.js';

const startLabel = 'io.eventsourcingdb.container-start';
const testLabel = 'io.eventsourcingdb.container-start-test';
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
const listContainers = async (testId: string): Promise<unknown[]> => {
	const client = await getContainerRuntimeClient();

	return await client.container.dockerode.listContainers({
		all: true,
		filters: { label: [`${testLabel}=${testId}`] },
	});
};

// Watches Docker for the containers that it creates for a test, and returns a
// function that stops watching and returns the start label of each of them.
// Docker keeps only the latest events, so the test watches while it runs,
// instead of asking for its events afterwards.
const watchCreatedContainers = async (testId: string): Promise<() => string[]> => {
	const client = await getContainerRuntimeClient();
	const events = await client.container.dockerode.getEvents({
		filters: { type: ['container'], event: ['create'], label: [`${testLabel}=${testId}`] },
	});
	if (!(events instanceof IncomingMessage)) {
		throw new Error('Failed to watch Docker.');
	}

	// Lets the test end even if it fails before it stops watching.
	events.socket.unref();

	const chunks: Buffer[] = [];
	events.on('data', (chunk: Buffer): void => {
		chunks.push(chunk);
	});

	return (): string[] => {
		events.destroy();

		return Buffer.concat(chunks)
			.toString('utf8')
			.split('\n')
			.filter(line => line !== '')
			.map(line => JSON.parse(line).Actor.Attributes[startLabel]);
	};
};

suite('startContainer', () => {
	const image = `thenativeweb/eventsourcingdb:${getImageTag()}`;

	test(
		'replaces a running container whose database does not become reachable, up to 3 containers, and removes each of them.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId);

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

			const startIds = stopWatching();
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
			const stopWatching = await watchCreatedContainers(testId);

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

			assert.equal(stopWatching().length, 3);
			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'fails at once with the end of the log if the container exits, and removes it.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId);

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

			assert.equal(stopWatching().length, 1);
			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'fails at once with the error of Docker if the image does not exist.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId);

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

			assert.equal(stopWatching().length, 0);
			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'fails at once with the error of Docker if Docker fails after creating the container, and removes it.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId);

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

			assert.equal(stopWatching().length, 1);
			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'replaces a running container whose port testcontainers cannot find, and removes it.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const endFailing = await failPortLookups(1);
			const stopWatching = await watchCreatedContainers(testId);

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
				const startIds = stopWatching();
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
			const stopWatching = await watchCreatedContainers(testId);

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

			assert.equal(stopWatching().length, 3);
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
					await sleep(2000);
				}
				await pull.apply(imageClient, parameters);
			};

			const stopWatching = await watchCreatedContainers(testId);

			let container: StartedTestContainer;
			try {
				container = await startContainer({
					image,
					port: 3000,
					command: getCommand(3000),
					contents: [],
					startupTimeout: 1500,
					labels: { [testLabel]: testId },
				});
			} finally {
				imageClient.pull = pull;
			}

			try {
				assert.ok(pullCount >= 1);

				// Had the pull counted, the first attempt would have created its
				// container late, and another attempt one more.
				assert.equal(stopWatching().length, 1);
			} finally {
				await container.stop();
			}

			assert.deepEqual(await listContainers(testId), []);
		},
	);

	test(
		'starts a container whose database becomes reachable.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId);

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

				assert.equal(stopWatching().length, 1);
			} finally {
				await container.stop();
			}

			assert.deepEqual(await listContainers(testId), []);
		},
	);
});
