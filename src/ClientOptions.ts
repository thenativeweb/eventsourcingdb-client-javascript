interface ClientOptions {
	// A request fails once nothing arrives from the server for this many
	// milliseconds. Every byte, including a heartbeat, restarts the clock, so a
	// long stream that keeps receiving something is never cut off. Defaults to
	// 30 seconds.
	stallTimeout?: number;
}

export type { ClientOptions };
