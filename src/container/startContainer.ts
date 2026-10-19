import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { ContainerRuntimeClient } from 'testcontainers';
import {
	getContainerRuntimeClient,
	getReaper,
	ImageName,
	LABEL_TESTCONTAINERS_SESSION_ID,
} from 'testcontainers';
import { waitUnlessAborted } from '../http/waitUnlessAborted.js';
import { isRecord } from '../types/isRecord.js';
import { attachOutput } from './attachOutput.js';
import { ContainerExitedError } from './ContainerExitedError.js';
import type { ContentToCopy } from './createArchive.js';
import { createArchive } from './createArchive.js';
import { waitUntilReachable } from './waitUntilReachable.js';

interface StartContainerOptions {
	image: string;
	port: number;
	command: string[];
	contents: ContentToCopy[];
	startupTimeout: number;
	labels?: Record<string, string>;
}

interface StartedContainer {
	host: string;
	mappedPort: number;
	stop: () => Promise<void>;
}

interface Attempt {
	client: ContainerRuntimeClient;
	image: ImageName;
	labels: Record<string, string>;
	options: StartContainerOptions;
	signal: AbortSignal;
}

const maximumAttempts = 3;
const millisecondsPerSecond = 1000;
const startLabel = 'io.eventsourcingdb.container-start';
const statusNotFound = 404;
const statusConflict = 409;

// A container that is gone, or that Docker is removing already, needs no
// removing.
const isGone = (error: unknown): boolean =>
	isRecord(error) && (error.statusCode === statusNotFound || error.statusCode === statusConflict);

// Removes the containers of an attempt by its label, whatever state they are
// in, so that this also finds a container whose creation was still pending.
const removeContainers = async (client: ContainerRuntimeClient, startId: string): Promise<void> => {
	const { dockerode } = client.container;
	const containers = await dockerode.listContainers({
		all: true,
		filters: { label: [`${startLabel}=${startId}`] },
	});

	await Promise.all(
		containers.map(async ({ Id: id }): Promise<void> => {
			try {
				await dockerode.getContainer(id).remove({ force: true, v: true });
			} catch (error) {
				if (!isGone(error)) {
					throw error;
				}
			}
		}),
	);
};

// Creates the container, copies the files into it, starts it, and waits until
// its database is reachable, while it follows the output of the container.
// Once the signal aborts, it does not take the next step, so that it does not
// start a container whose time has run out.
const createAndStart = async ({
	client,
	image,
	labels,
	options,
	signal,
}: Attempt): Promise<StartedContainer> => {
	const exposedPort = `${options.port}/tcp`;
	const container = await client.container.create({
		Image: image.string,
		Cmd: options.command,
		Labels: labels,
		ExposedPorts: { [exposedPort]: {} },
		HostConfig: { PortBindings: { [exposedPort]: [{ HostPort: '0' }] } },
	});

	if (options.contents.length > 0) {
		signal.throwIfAborted();
		await client.container.putArchive(
			container,
			Readable.from(createArchive(options.contents)),
			'/',
		);
	}

	signal.throwIfAborted();
	const output = await attachOutput(client, container);

	try {
		signal.throwIfAborted();
		await client.container.start(container);

		const mappedPort = await waitUntilReachable({
			client,
			container,
			output,
			port: options.port,
			signal,
		});

		return {
			host: client.info.containerRuntime.host,
			mappedPort,
			stop: async (): Promise<void> => {
				await client.container.stop(container, { timeout: 0 });
				await client.container.remove(container, { removeVolumes: true });
			},
		};
	} finally {
		output.detach();
	}
};

// Starts a container and waits until its database is reachable, for the
// startup timeout at most, from creating the container on. If that fails, it
// removes the container at once. If the time ran out while Docker was still
// creating or starting the container, it then waits for that to end, and
// removes what was created meanwhile. It returns undefined if the database did
// not become reachable in time, so that another container can take its place.
const attemptToStart = async (
	client: ContainerRuntimeClient,
	image: ImageName,
	sessionId: string,
	options: StartContainerOptions,
): Promise<StartedContainer | undefined> => {
	const startId = randomUUID();
	const deadline = new AbortController();
	const timer = setTimeout(() => {
		deadline.abort();
	}, options.startupTimeout);

	const starting = createAndStart({
		client,
		image,
		labels: {
			...options.labels,
			[LABEL_TESTCONTAINERS_SESSION_ID]: sessionId,
			[startLabel]: startId,
		},
		options,
		signal: deadline.signal,
	});

	try {
		return await waitUnlessAborted(starting, deadline.signal);
	} catch (error) {
		await removeContainers(client, startId);

		// The attempt has failed already, so how the start ends no longer
		// matters, only that nothing of it is left.
		await Promise.allSettled([starting]);
		await removeContainers(client, startId);

		if (deadline.signal.aborted && error === deadline.signal.reason) {
			return undefined;
		}

		throw error;
	} finally {
		clearTimeout(timer);
	}
};

// Starts a container with EventSourcingDB and waits until the database is
// reachable. A container that is running, but whose database does not become
// reachable within the startup timeout, gives way to another one, up to 3
// containers in total. If Docker fails, or if the container exits, starting
// fails at once. Ryuk removes the containers once the process ends, as it does
// for the other containers of testcontainers.
const startContainer = async (options: StartContainerOptions): Promise<StartedContainer> => {
	try {
		const client = await getContainerRuntimeClient();
		const image = ImageName.fromString(options.image);

		// Neither pulling the image nor starting Ryuk counts towards the startup
		// timeout.
		await client.image.pull(image);
		const { sessionId } = await getReaper(client);

		for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
			// biome-ignore lint/performance/noAwaitInLoops: Each attempt waits for the one before.
			const startedContainer = await attemptToStart(client, image, sessionId, options);

			if (startedContainer !== undefined) {
				return startedContainer;
			}
		}
	} catch (error) {
		if (error instanceof ContainerExitedError) {
			throw error;
		}

		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to start the container: ${message}`, { cause: error });
	}

	throw new Error(
		`Failed to start the container, the database did not become reachable within ${options.startupTimeout / millisecondsPerSecond}s in any of ${maximumAttempts} containers`,
	);
};

export type { StartContainerOptions, StartedContainer };
export { startContainer };
