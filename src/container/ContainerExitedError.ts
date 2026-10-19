// The container exited before the database in it became reachable, so another
// container would fail the same way.
class ContainerExitedError extends Error {
	public constructor(logTail: string) {
		super(
			`Failed to start the container, it exited before the database became reachable: ${logTail}`,
		);
	}
}

export { ContainerExitedError };
