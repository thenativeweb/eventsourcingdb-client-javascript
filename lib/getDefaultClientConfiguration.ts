import { ClientConfiguration } from './ClientConfiguration';

const getDefaultClientConfiguration = function (baseUrl: string): ClientConfiguration {
	return {
		baseUrl,
		timeoutMilliseconds: 10_000,
		accessToken: '',
		protocolVersion: '1.0.0',
		maxTries: 10,
	};
};

export { getDefaultClientConfiguration };
