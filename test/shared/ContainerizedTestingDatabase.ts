import type { ClientOptions } from '../../lib/ClientOptions.js';
import { Client } from '../../lib/index.js';
import { ServerError } from '../../lib/util/error/ServerError.js';
import { done, retryWithBackoff } from '../../lib/util/retry/retryWithBackoff.js';
import type { Container } from './docker/Container.js';
import type { Image } from './docker/Image.js';

class ContainerizedTestingDatabase {
	private readonly command: string;

	private container: Container;

	public readonly client: Client;

	private readonly image: Image;

	private readonly options: ClientOptions;

	private constructor(
		image: Image,
		command: string,
		options: ClientOptions,
		client: Client,
		container: Container,
	) {
		this.command = command;
		this.image = image;
		this.options = options;
		this.client = client;
		this.container = container;
	}

	public static async create(
		image: Image,
		command: string,
		options: ClientOptions,
	): Promise<ContainerizedTestingDatabase> {
		const { client, container } = await ContainerizedTestingDatabase.start(image, command, options);

		return new ContainerizedTestingDatabase(image, command, options, client, container);
	}

	private static async start(image: Image, command: string, options: ClientOptions) {
		const container = image.run(command, true, true);
		const exposedPort = container.getExposedPort(3_000);
		const baseUrl = `http://127.0.0.1:${exposedPort}`;
		const client = new Client(baseUrl, options);

		await retryWithBackoff(new AbortController(), 10, async () => {
			try {
				await client.ping();
			} catch (ex: unknown) {
				if (ex instanceof ServerError) {
					return { retry: ex };
				}

				throw ex;
			}

			return done;
		});

		return {
			container,
			client,
		};
	}

	public stop(): void {
		this.container.kill();
	}
}

export { ContainerizedTestingDatabase };
