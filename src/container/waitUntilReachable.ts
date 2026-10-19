import { setTimeout as sleep } from 'node:timers/promises';
import type { ContainerRuntimeClient } from 'testcontainers';
import type { ContainerOutput, DockerContainer } from './attachOutput.js';
import { ContainerExitedError } from './ContainerExitedError.js';

type ContainerInspection = Awaited<ReturnType<ContainerRuntimeClient['container']['inspect']>>;

interface Readiness {
	client: ContainerRuntimeClient;
	container: DockerContainer;
	output: ContainerOutput;
	port: number;
	signal: AbortSignal;
}

const pollInterval = 100;
const pingTimeout = 1000;
const statusOk = 200;
const logTailLength = 20;
const exitedStates = new Set(['exited', 'dead']);

// Until Docker has published the port, it has no binding.
const readMappedPort = (inspection: ContainerInspection, port: number): number | undefined => {
	const hostPort = inspection.NetworkSettings.Ports[`${port}/tcp`]?.[0]?.HostPort;

	if (hostPort === undefined || hostPort === '') {
		return undefined;
	}

	return Number(hostPort);
};

const isReachable = async (url: URL, signal: AbortSignal): Promise<boolean> => {
	try {
		const response = await fetch(url, {
			signal: AbortSignal.any([signal, AbortSignal.timeout(pingTimeout)]),
		});
		await response.body?.cancel();

		return response.status === statusOk;
	} catch {
		// While the database starts, a ping fails, for example since nothing
		// listens on the port yet, so this is no error, but a reason to ask again.
		return false;
	}
};

// Returns the mapped port once the database answers on it, and undefined
// until then.
const poll = async ({
	client,
	container,
	output,
	port,
	signal,
}: Readiness): Promise<number | undefined> => {
	const inspection = await client.container.inspect(container);

	if (exitedStates.has(inspection.State.Status)) {
		throw new ContainerExitedError(await output.readTail(logTailLength));
	}

	const mappedPort = readMappedPort(inspection, port);
	if (mappedPort === undefined) {
		return undefined;
	}

	const url = new URL(`http://${client.info.containerRuntime.host}:${mappedPort}/api/v1/ping`);
	if (!(await isReachable(url, signal))) {
		return undefined;
	}

	return mappedPort;
};

// Waits until the database in the container answers a ping with the status
// 200, and returns the mapped port. It reads the mapped port anew on every
// poll, since Docker sometimes publishes the port late. If the container exits
// meanwhile, it fails with the last 20 lines of the output of the container.
// Once the signal aborts, it fails with the reason of the signal.
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
