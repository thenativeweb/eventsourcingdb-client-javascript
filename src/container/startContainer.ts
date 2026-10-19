import { randomUUID } from 'node:crypto';
import type {
	ContainerRuntimeClient,
	Content,
	StartedTestContainer,
	WaitStrategy,
} from 'testcontainers';
import { GenericContainer, getContainerRuntimeClient, getReaper, ImageName } from 'testcontainers';
import { waitUnlessAborted } from '../http/waitUnlessAborted.js';
import { ContainerExitedError } from './ContainerExitedError.js';
import { removeContainersOfAttempt, startLabel } from './containersOfAttempt.js';
import { waitUntilReachable } from './waitUntilReachable.js';

interface ContentToCopy {
	content: Content;
	target: string;
	mode?: number;
}

interface StartContainerOptions {
	image: string;
	port: number;
	command: string[];
	contents: ContentToCopy[];
	startupTimeout: number;
	labels?: Record<string, string>;
}

const maximumAttempts = 3;
const millisecondsPerSecond = 1000;

// testcontainers waits for the port of a container for 10 seconds at most, and
// then looks up the port on the host once. If either fails, the container is
// running, but it cannot be reached.
const portErrors = [
	/^Timed out after \d+ms while waiting for container ports to be bound to the host$/u,
	/^No host port found for host IP$/u,
];

const isPortError = (error: unknown): boolean =>
	error instanceof Error && portErrors.some(portError => portError.test(error.message));

// Lets testcontainers wait for the readiness of the database, which the
// attempt follows from the creation of the container on.
class ReadinessWait implements WaitStrategy {
	readonly #readiness: Promise<unknown>;
	readonly #startupTimeout: number;

	public constructor(readiness: Promise<unknown>, startupTimeout: number) {
		this.#readiness = readiness;
		this.#startupTimeout = startupTimeout;
	}

	public async waitUntilReady(): Promise<void> {
		await this.#readiness;
	}

	// testcontainers sets the timeout of a wait strategy only if the container
	// has a startup timeout of its own, which this one does not, since the
	// attempt has its own clock.
	public withStartupTimeout(): this {
		return this;
	}

	// biome-ignore lint/nursery/useThisInClassMethods: The interface of testcontainers asks for this method.
	public isStartupTimeoutSet(): boolean {
		return true;
	}

	public getStartupTimeout(): number {
		return this.#startupTimeout;
	}
}

// Starts a container and waits until its database is reachable, for the
// startup timeout at most, from creating the container on. If that fails, it
// removes the container at once. If the time ran out while Docker was still
// creating or starting the container, it then waits for that to end, and
// removes what was created meanwhile. It returns undefined if the database did
// not become reachable, so that another container can take its place.
const attemptToStart = async (
	client: ContainerRuntimeClient,
	options: StartContainerOptions,
): Promise<StartedTestContainer | undefined> => {
	const startId = randomUUID();
	const deadline = new AbortController();
	const timer = setTimeout(() => {
		deadline.abort();
	}, options.startupTimeout);
	const attemptEnded = new AbortController();

	const readiness = waitUntilReachable({
		client,
		startId,
		port: options.port,
		signal: AbortSignal.any([deadline.signal, attemptEnded.signal]),
	});
	const starting = new GenericContainer(options.image)
		.withExposedPorts(options.port)
		.withCommand(options.command)
		.withCopyContentToContainer(options.contents)
		.withLabels({ ...options.labels, [startLabel]: startId })
		.withWaitStrategy(new ReadinessWait(readiness, options.startupTimeout))
		.start();

	try {
		const [container] = await waitUnlessAborted(
			Promise.all([starting, readiness]),
			deadline.signal,
		);

		return container;
	} catch (error) {
		attemptEnded.abort();
		await removeContainersOfAttempt(client, startId);

		// The attempt has failed already, so how the start ends no longer
		// matters, only that nothing of it is left.
		await Promise.allSettled([starting, readiness]);
		await removeContainersOfAttempt(client, startId);

		if ((deadline.signal.aborted && error === deadline.signal.reason) || isPortError(error)) {
			return undefined;
		}

		throw error;
	} finally {
		attemptEnded.abort();
		clearTimeout(timer);
	}
};

// Starts a container with EventSourcingDB and waits until the database is
// reachable. A container that is running, but whose database does not become
// reachable within the startup timeout, gives way to another one, up to 3
// containers in total. If Docker fails, or if the container exits, starting
// fails at once.
const startContainer = async (options: StartContainerOptions): Promise<StartedTestContainer> => {
	try {
		const client = await getContainerRuntimeClient();

		// Neither pulling the image nor starting Ryuk counts towards the startup
		// timeout.
		await client.image.pull(ImageName.fromString(options.image));
		await getReaper(client);

		for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
			// biome-ignore lint/performance/noAwaitInLoops: Each attempt waits for the one before.
			const container = await attemptToStart(client, options);

			if (container !== undefined) {
				return container;
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

export type { ContentToCopy, StartContainerOptions };
export { startContainer };
