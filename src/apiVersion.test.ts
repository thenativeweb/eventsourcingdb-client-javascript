import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import type { ApiVersion } from './detectApiVersion.js';
import { getImageTag } from './getImageTag.js';
import { getApiVersionOf } from './testing/getApiVersionOf.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

// The paths that a client requests to verify the API token through each API,
// after the ping of the v2 API with which it finds out which API to use. The
// paths differ between the APIs, unlike those of a ping.
const expectedPaths: Record<ApiVersion, string[]> = {
	v1: ['/api/v2/system/ping', '/api/v1/verify-api-token'],
	v2: ['/api/v2/system/ping', '/api/v2/system/verify-token'],
};

const getPath = (input: string | URL | Request): string => {
	if (input instanceof Request) {
		return new URL(input.url).pathname;
	}

	return new URL(input).pathname;
};

suite('apiVersion', () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
		await container.start();
	}, integrationTimeout);

	afterEach(async () => {
		await container.stop();
	}, integrationTimeout);

	test(
		'uses the API that the database offers.',
		integrationTimeout,
		async (context): Promise<void> => {
			// The test asks the database itself which API it offers, rather than
			// going by the image tag, since a database that offers the v2 API still
			// offers the v1 API as well, so every other test passes through either.
			const apiVersion = await getApiVersionOf(container);
			const client = container.getClient();

			const observedFetch = context.mock.method(globalThis, 'fetch');
			await client.verifyApiToken();

			assert.deepEqual(
				observedFetch.mock.calls.map(call => getPath(call.arguments[0])),
				expectedPaths[apiVersion],
			);
		},
	);
});
