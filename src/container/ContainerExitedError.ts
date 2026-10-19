// The container exited before the database in it became reachable, so another
// container would fail the same way. testcontainers reads the log without
// passing on errors of Docker, so an empty log may mean that it is not
// available.
class ContainerExitedError extends Error {
	public constructor(logTail: string) {
		super(
			`Failed to start the container, it exited before the database became reachable: ${logTail === '' ? 'no log available' : logTail}`,
		);
	}
}

export { ContainerExitedError };
