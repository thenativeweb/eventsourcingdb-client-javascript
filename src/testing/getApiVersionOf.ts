import type { Container } from '../Container.js';
import type { ApiVersion } from '../detectApiVersion.js';

// Tells which API the database in the container offers, for tests whose
// expectations differ between the APIs, such as the status of an error.
const getApiVersionOf = async (container: Container): Promise<ApiVersion> => {
	const response = await fetch(new URL('/api/v2/system/ping', container.getBaseUrl()));
	await response.text();

	return response.status === 200 ? 'v2' : 'v1';
};

export { getApiVersionOf };
