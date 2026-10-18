// A request fails once nothing arrives from the server for this many
// milliseconds, unless the client is configured otherwise.
const defaultStallTimeout = 30_000;

// Node.js runs a timer for at most this many milliseconds.
const maximumStallTimeout = 2_147_483_647;

export { defaultStallTimeout, maximumStallTimeout };
