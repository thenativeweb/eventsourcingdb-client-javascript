import type { StartedTestContainer } from 'testcontainers';
import { GenericContainer, Wait } from 'testcontainers';
import { Client } from './Client.js';

class Container {
	#imageName = 'thenativeweb/eventsourcingdb';
	#imageTag = 'latest';
	#internalPort = 3000;
	#apiToken = 'secret';
	#container: StartedTestContainer | undefined;

	public withImageTag(tag: string): this {
		this.#imageTag = tag;
		return this;
	}

	public withApiToken(token: string): this {
		this.#apiToken = token;
		return this;
	}

	public withPort(port: number): this {
		this.#internalPort = port;
		return this;
	}

	public async start(): Promise<void> {
		this.#container = await new GenericContainer(`${this.#imageName}:${this.#imageTag}`)
			.withExposedPorts(this.#internalPort)
			.withCommand([
				'run',
				'--api-token',
				this.#apiToken,
				'--data-directory-temporary',
				'--http-enabled',
				'--https-enabled=false',
			])
			.withWaitStrategy(Wait.forHttp('/api/v1/ping', this.#internalPort).withStartupTimeout(10_000))
			.start();
	}

	public getHost(): string {
		if (this.#container === undefined) {
			throw new Error('Container must be running.');
		}

		return this.#container.getHost();
	}

	public getMappedPort(): number {
		if (this.#container === undefined) {
			throw new Error('Container must be running.');
		}

		return this.#container.getMappedPort(this.#internalPort);
	}

	public getBaseUrl(): URL {
		if (this.#container === undefined) {
			throw new Error('Container must be running.');
		}

		const host = this.getHost();
		const port = this.getMappedPort();

		return new URL(`http://${host}:${port}`);
	}

	public getApiToken(): string {
		return this.#apiToken;
	}

	public isRunning(): boolean {
		return this.#container !== undefined;
	}

	public async stop(): Promise<void> {
		if (this.#container === undefined) {
			return;
		}

		await this.#container.stop();
		this.#container = undefined;
	}

	public getClient(): Client {
		return new Client(this.getBaseUrl(), this.getApiToken());
	}
}

export { Container };
