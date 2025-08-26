import crypto from 'node:crypto';
import type { Content, StartedTestContainer } from 'testcontainers';
import { GenericContainer, Wait } from 'testcontainers';
import { Client } from './Client.js';

type ContentToCopy = {
	content: Content;
	target: string;
	mode?: number;
};

class Container {
	#imageName = 'thenativeweb/eventsourcingdb';
	#imageTag = 'latest';
	#internalPort = 3000;
	#apiToken = 'secret';
	#signingKey: crypto.KeyObject | undefined;
	#container: StartedTestContainer | undefined;

	public withImageTag(tag: string): this {
		this.#imageTag = tag;
		return this;
	}

	public withApiToken(token: string): this {
		this.#apiToken = token;
		return this;
	}

	public withSigningKey(): this {
		const { privateKey } = crypto.generateKeyPairSync('ed25519');
		this.#signingKey = privateKey;
		return this;
	}

	public withPort(port: number): this {
		this.#internalPort = port;
		return this;
	}

	public async start(): Promise<void> {
		const command = [
			'run',
			'--api-token',
			this.#apiToken,
			'--data-directory-temporary',
			'--http-enabled',
			'--https-enabled=false',
		];

		const contents: ContentToCopy[] = [];

		if (this.#signingKey !== undefined) {
			command.push('--signing-key-file');
			command.push('/etc/esdb/signing-key.pem');

			contents.push({
				content: this.#signingKey.export({ format: 'pem', type: 'pkcs8' }),
				target: '/etc/esdb/signing-key.pem',
				mode: 0o777,
			});
		}

		this.#container = await new GenericContainer(`${this.#imageName}:${this.#imageTag}`)
			.withExposedPorts(this.#internalPort)
			.withCommand(command)
			.withCopyContentToContainer(contents)
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

	public getSigningKey(): crypto.KeyObject {
		if (this.#signingKey === undefined) {
			throw new Error('Signing key not set.');
		}
		return this.#signingKey;
	}

	public getVerificationKey(): crypto.KeyObject {
		if (this.#signingKey === undefined) {
			throw new Error('Signing key not set.');
		}

		const verificationKey = crypto.createPublicKey(this.#signingKey);
		return verificationKey;
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
