import type { ClientConfiguration } from './ClientConfiguration.js';

const getDefaultClientConfiguration = (baseUrl: string): ClientConfiguration => {
	return {
		baseUrl,
		timeoutMilliseconds: 10_000,
		accessToken: '',
		protocolVersion: '1.0.0',
	};
};

export { getDefaultClientConfiguration };
