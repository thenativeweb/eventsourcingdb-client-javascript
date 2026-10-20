// A hook that starts a container may need 3 attempts of 30 seconds each, plus
// pulling the image and removing the containers of failed attempts, so it has
// a budget larger than the one of a test.
const containerStartTimeout = { timeout: 180_000 };

export { containerStartTimeout };
