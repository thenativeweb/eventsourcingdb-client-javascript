// The integration tests start a container of their own for each test, which
// takes as long as Docker needs, so a busy Docker makes the starts slow. A
// budget for a whole suite shrinks with every start and cancels the last tests
// of a suite. So every start and stop, and every test, has a budget of its
// own, which node:test keeps apart, since the budget of a test does not count
// its hooks. A start may take 3 attempts of 30 seconds each, plus pulling the
// image and removing the containers of failed attempts.
const integrationTimeout = { timeout: 180_000 };

export { integrationTimeout };
