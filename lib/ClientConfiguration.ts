interface ClientConfiguration {
	baseUrl: string;
	timeoutMilliseconds: number;
	accessToken: string;
	protocolVersion: string;
	maxTries: number;
}

export { ClientConfiguration };
