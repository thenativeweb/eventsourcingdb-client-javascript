import { setTimeout as sleep } from 'node:timers/promises';
import type { ContainerRuntimeClient } from 'testcontainers';
import { ContainerExitedError } from './ContainerExitedError.js';
import type { ContainerInfo } from './containersOfAttempt.js';
import { listContainersOfAttempt } from './containersOfAttempt.js';
import { isReachable } from './isReachable.js';

interface Readiness {
	client: ContainerRuntimeClient;
	startId: string;
	port: number;
	signal: AbortSignal;
}

const pollInterval = 100;
const logTailLength = 20;
const exitedStates = new Set(['exited', 'dead']);

const readLogTail = async (
	client: ContainerRuntimeClient,
	id: string,
	signal: AbortSignal,
): Promise<string> => {
	const logs = await client.container.logs(client.container.getById(id), { tail: logTailLength });
	const chunks: string[] = await logs.toArray({ signal });

	return chunks.join('').trimEnd();
};

// Until Docker has published the port, it has no public port.
const readMappedPort = (container: ContainerInfo, port: number): number | undefined =>
	container.Ports.find(
		({ PrivatePort, PublicPort, Type }) => PrivatePort === port && Type === 'tcp' && PublicPort > 0,
	)?.PublicPort;

// Returns the mapped port once the database answers on it, and undefined
// until then.
// biome-ignore lint/nursery/noExcessiveStatementsPerFunction: A poll checks the container, its port, and its database in turn, and each check can end the poll early.
const poll = async ({ client, startId, port, signal }: Readiness): Promise<number | undefined> => {
	const [container] = await listContainersOfAttempt(client, startId);
	if (container === undefined) {
		return undefined;
	}

	if (exitedStates.has(container.State)) {
		throw new ContainerExitedError(await readLogTail(client, container.Id, signal));
	}

	const mappedPort = readMappedPort(container, port);
	if (mappedPort === undefined) {
		return undefined;
	}

	const url = new URL(`http://${client.info.containerRuntime.host}:${mappedPort}`);
	if (!(await isReachable(url, signal))) {
		return undefined;
	}

	return mappedPort;
};

// Waits from the creation of the container of an attempt on until its database
// answers a ping with the status 200. It looks for the container by the label
// of the attempt, and reads the mapped port anew on every poll, since Docker
// sometimes publishes the port late. If the container exits meanwhile, it fails
// with the last 20 lines of its log. Once the signal aborts, it fails with the
// reason of the signal.
const waitUntilReachable = async (readiness: Readiness): Promise<number> => {
	for (;;) {
		readiness.signal.throwIfAborted();

		// biome-ignore lint/performance/noAwaitInLoops: Each poll waits for the one before.
		const mappedPort = await poll(readiness);
		if (mappedPort !== undefined) {
			return mappedPort;
		}

		await sleep(pollInterval);
	}
};

export { waitUntilReachable };
