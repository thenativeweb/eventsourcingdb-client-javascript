import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { suite, test } from 'node:test';
import { getContainerRuntimeClient } from 'testcontainers';
import { getImageTag } from '../getImageTag.js';
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
					// than 20 lines in all. Docker passes on stdout and stderr in the
					// order in which they arrive, so the last line may come from either.
					const logLines = error.message.slice(exitedPrefix.length).split('\n');
					assert.equal(logLines.length, 20);
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
		'starts a container whose database becomes reachable.',
		integrationTimeout,
		async (): Promise<void> => {
			const testId = randomUUID();
			const stopWatching = await watchCreatedContainers(testId);

			const { host, mappedPort, stop } = await startContainer({
				image,
				port: 3000,
				command: getCommand(3000),
				contents: [],
				startupTimeout: 20_000,
				labels: { [testLabel]: testId },
			});

			try {
				const response = await fetch(`http://${host}:${mappedPort}/api/v1/ping`);
				assert.equal(response.status, 200);
				await response.body?.cancel();

				assert.equal(stopWatching().length, 1);
			} finally {
				await stop();
			}

			assert.deepEqual(await listContainers(testId), []);
		},
	);
});
