// A stream that carries heartbeats ends with a HeartbeatTimeoutError if no line
// arrives for this long. The package does not export this, only tests shorten it.
const heartbeatTimeout = {
	milliseconds: 30_000,
};

export { heartbeatTimeout };
