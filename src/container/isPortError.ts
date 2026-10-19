// testcontainers waits for the port of a container for 10 seconds at most, and
// then looks up the port on the host once. If either fails, the container is
// running, but it cannot be reached.
const portErrors = [
	/^Timed out after \d+ms while waiting for container ports to be bound to the host$/u,
	/^No host port found for host IP$/u,
];

const isPortError = (error: unknown): boolean =>
	error instanceof Error && portErrors.some(portError => portError.test(error.message));

export { isPortError };
