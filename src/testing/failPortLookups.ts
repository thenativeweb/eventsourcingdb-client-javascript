import { getContainerRuntimeClient, getReaper } from 'testcontainers';

// testcontainers looks up the port of a container on the host once per start,
// by the addresses of the host. Without any, the lookup fails with the error
// that testcontainers gives when Docker publishes the port only for another
// address. Lets the given number of lookups fail that way, and returns a
// function that ends that.
const failPortLookups = async (count: number): Promise<() => void> => {
	const client = await getContainerRuntimeClient();

	// Ryuk starts with the first container of the process, so it starts before
	// the lookups fail, and does not count among them.
	await getReaper(client);

	const { containerRuntime } = client.info;
	const { hostIps } = containerRuntime;
	let lookupCount = 0;

	Object.defineProperty(containerRuntime, 'hostIps', {
		configurable: true,
		get: (): typeof hostIps => {
			lookupCount += 1;
			if (lookupCount <= count) {
				return [];
			}
			return hostIps;
		},
	});

	return (): void => {
		Object.defineProperty(containerRuntime, 'hostIps', {
			configurable: true,
			enumerable: true,
			writable: true,
			value: hostIps,
		});
	};
};

export { failPortLookups };
