class HeartbeatTimeoutError extends Error {
	public constructor() {
		super('No event and no heartbeat arrived for 30 seconds.');
		this.name = 'HeartbeatTimeoutError';
	}
}

export { HeartbeatTimeoutError };
