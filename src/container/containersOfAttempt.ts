import type { ContainerRuntimeClient } from 'testcontainers';
import { isRecord } from '../types/isRecord.js';

type ContainerInfo = Awaited<
	ReturnType<ContainerRuntimeClient['container']['dockerode']['listContainers']>
>[number];

// Every attempt to start a container labels its container with an id of its
// own, by which it finds the container, whatever state it is in, even before
// testcontainers hands it over.
const startLabel = 'io.eventsourcingdb.container-start';
const statusNotFound = 404;
const statusConflict = 409;

// A container that is gone, or that Docker is removing already, needs no
// removing.
const isGone = (error: unknown): boolean =>
	isRecord(error) && (error.statusCode === statusNotFound || error.statusCode === statusConflict);

const listContainersOfAttempt = async (
	client: ContainerRuntimeClient,
	startId: string,
): Promise<ContainerInfo[]> =>
	await client.container.dockerode.listContainers({
		all: true,
		filters: { label: [`${startLabel}=${startId}`] },
	});

const removeContainersOfAttempt = async (
	client: ContainerRuntimeClient,
	startId: string,
): Promise<void> => {
	const containers = await listContainersOfAttempt(client, startId);

	await Promise.all(
		containers.map(async ({ Id: id }): Promise<void> => {
			try {
				await client.container.dockerode.getContainer(id).remove({ force: true, v: true });
			} catch (error) {
				if (!isGone(error)) {
					throw error;
				}
			}
		}),
	);
};

export type { ContainerInfo };
export { listContainersOfAttempt, removeContainersOfAttempt, startLabel };
