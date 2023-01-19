import { Container } from './docker/Container';
import { Image } from './docker/Image';
import { Client } from '../../lib';
import { ClientOptions } from '../../lib/ClientOptions';
import { retryWithBackoff } from '../../lib/util/retry/retryWithBackoff';

class ContainerizedTestingDatabase {
	readonly #command: string;

	#container: Container;

	#client: Client;

	readonly #image: Image;

	readonly #options: ClientOptions;

	#isFirstRun = true;

	private constructor(
		image: Image,
		command: string,
		options: ClientOptions,
		client: Client,
		container: Container,
	) {
		this.#command = command;
		this.#image = image;
		this.#options = options;
		this.#client = client;
		this.#container = container;
	}

	public static async NewContainerizedTestingDatabase(
		image: Image,
		command: string,
		options: ClientOptions,
	): Promise<ContainerizedTestingDatabase> {
		const { client, container } = await ContainerizedTestingDatabase.#start(
			image,
			command,
			options,
		);

		return new ContainerizedTestingDatabase(image, command, options, client, container);
	}

	static async #start(image: Image, command: string, options: ClientOptions) {
		const container = image.run(command, true, true);
		const exposedPort = container.getExposedPort(3_000);
		const baseUrl = `http://localhost:${exposedPort}`;

		const client = new Client(baseUrl, options);

		await retryWithBackoff(new AbortController(), 10, async (): Promise<void> => {
			await client.ping();
		});

		return {
			container,
			client,
		};
	}

	async #restart() {
		this.#container.kill();

		const { container, client } = await ContainerizedTestingDatabase.#start(
			this.#image,
			this.#command,
			this.#options,
		);

		this.#container = container;
		this.#client = client;
	}

	public stop() {
		this.#container.kill();
	}

	public async getClient(): Promise<Client> {
		if (this.#isFirstRun) {
			this.#isFirstRun = false;
			return this.#client;
		}

		await this.#restart();

		return this.#client;
	}
}

export { ContainerizedTestingDatabase };
