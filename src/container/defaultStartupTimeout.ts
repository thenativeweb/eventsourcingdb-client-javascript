// Each attempt to start a container may take this many milliseconds, from
// creating the container until the database answers a ping, unless the
// container is configured otherwise.
const defaultStartupTimeout = 30_000;

// Node.js runs a timer for at most this many milliseconds.
const maximumStartupTimeout = 2_147_483_647;

export { defaultStartupTimeout, maximumStartupTimeout };
