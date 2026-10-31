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
import { isPortError } from './isPortError.js';
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
	settleTimeout?: number;

	// Receives the removal that runs in the background once the wait for a
	// pending start has run out, so that a test can wait for it.
	onBackgroundRemoval?: (removal: Promise<void>) => void;
}

const maximumAttempts = 3;
const millisecondsPerSecond = 1000;
const defaultSettleTimeout = 10_000;

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

	// biome-ignore lint/style/useThisInClassMethods: The interface of testcontainers asks for this method.
	public isStartupTimeoutSet(): boolean {
		return true;
	}

	public getStartupTimeout(): number {
		return this.#startupTimeout;
	}
}

const getMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

// Waits for the promises to settle, but for the given time at most, and
// returns whether they have settled.
const waitForSettling = async (promises: Promise<unknown>[], timeout: number): Promise<boolean> => {
	let timer: ReturnType<typeof setTimeout> | undefined;

	const hasSettled = await Promise.race([
		Promise.allSettled(promises).then(() => true),
		new Promise<boolean>(resolve => {
			timer = setTimeout(() => {
				resolve(false);
			}, timeout);
		}),
	]);
	clearTimeout(timer);

	return hasSettled;
};

// Starts a container and waits until its database is reachable, for the
// startup timeout at most, from creating the container on. If that fails, it
// removes the container at once. If the time ran out while Docker was still
// creating or starting the container, it then waits for that to end, for a
// while at most, and removes what was created meanwhile. If that takes longer,
// it removes the container once Docker has created it, without waiting for
// that. A failed removal does not change the outcome of the attempt, but is
// collected. It returns
// undefined if the database did not become reachable, so that another
// container can take its place.
const attemptToStart = async (
	client: ContainerRuntimeClient,
	options: StartContainerOptions,
	removalErrors: unknown[],
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
		const removeContainers = async (): Promise<void> => {
			try {
				await removeContainersOfAttempt(client, startId);
			} catch (removalError) {
				removalErrors.push(removalError);
			}
		};

		await removeContainers();

		// The attempt has failed already, so how the start ends no longer
		// matters, only that nothing of it is left.
		const hasSettled = await waitForSettling(
			[starting, readiness],
			options.settleTimeout ?? defaultSettleTimeout,
		);
		await removeContainers();

		if (!hasSettled) {
			// The caller does not wait for a start that Docker does not finish, and
			// the removal collects its own errors.
			const removal = Promise.allSettled([starting]).then(removeContainers);
			options.onBackgroundRemoval?.(removal);
		}

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
	const removalErrors: unknown[] = [];
	const createError = (message: string, errorOptions?: ErrorOptions): Error =>
		new Error(
			[
				message,
				...removalErrors.map(
					removalError => `Failed to remove a container: ${getMessage(removalError)}`,
				),
			].join('\n'),
			errorOptions,
		);

	try {
		const client = await getContainerRuntimeClient();

		// Neither pulling the image nor starting Ryuk counts towards the startup
		// timeout.
		await client.image.pull(ImageName.fromString(options.image));
		await getReaper(client);

		for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
			// biome-ignore lint/performance/noAwaitInLoops: Each attempt waits for the one before.
			const container = await attemptToStart(client, options, removalErrors);

			if (container !== undefined) {
				return container;
			}
		}
	} catch (error) {
		if (error instanceof ContainerExitedError) {
			throw createError(error.message);
		}

		throw createError(`Failed to start the container: ${getMessage(error)}`, { cause: error });
	}

	throw createError(
		`Failed to start the container, the database did not become reachable within ${options.startupTimeout / millisecondsPerSecond}s in any of ${maximumAttempts} containers`,
	);
};

export type { ContentToCopy, StartContainerOptions };
export { startContainer };
