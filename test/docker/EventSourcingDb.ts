import { setTimeout } from 'node:timers/promises';
import getPort from 'get-port';
import { exec } from 'shelljs';
import { Client } from '../../src/Client.js';

const imageName = 'thenativeweb/eventsourcingdb-test:latest';

class EventSourcingDb {
	readonly #id: string;
	readonly #port: number;
	readonly #apiToken: string;

	public get port(): number {
		return this.#port;
	}

	public get apiToken(): string {
		return this.#apiToken;
	}

	private constructor(id: string, port: number, apiToken: string) {
		this.#id = id;
		this.#port = port;
		this.#apiToken = apiToken;
	}

	public static build(): void {
		const cmd = `docker build -t ${imageName} .`;

		const result = exec(cmd, {
			cwd: __dirname,
			async: false,
		});

		if (result.code !== 0) {
			throw new Error(
				`Failed to build Docker image, code: ${result.code}, stdout: ${result.stdout}, stderr: ${result.stderr}`,
			);
		}
	}

	public static async run(): Promise<EventSourcingDb> {
		const port = await getPort();
		const apiToken = 'secret';

		const cmd = `docker run --detach --init --publish ${port}:3000 ${imageName} run --api-token ${apiToken} --data-directory-temporary --http-enabled --https-enabled=false`;

		const result = exec(cmd, {
			cwd: __dirname,
			async: false,
		});

		if (result.code !== 0) {
			throw new Error(
				`Failed to run Docker container, code: ${result.code}, stdout: ${result.stdout}, stderr: ${result.stderr}`,
			);
		}

		const id = result.stdout.trim();

		const client = new Client(new URL(`http://localhost:${port}`), apiToken);

		let isRunning = false;
		for (let i = 0; i < 50; i++) {
			try {
				await client.ping();
				isRunning = true;
				break;
			} catch {
				// Intentionally ignore error.
				await setTimeout(100);
			}
		}
		if (!isRunning) {
			throw new Error('Failed to start Docker container.');
		}

		return new EventSourcingDb(id, port, apiToken);
	}

	public kill(): void {
		const cmd = `docker kill ${this.#id}`;

		const result = exec(cmd, {
			cwd: __dirname,
			async: false,
		});

		if (result.code !== 0) {
			throw new Error(
				`Failed to kill Docker container, code: ${result.code}, stdout: ${result.stdout}, stderr: ${result.stderr}`,
			);
		}
	}
}

export { EventSourcingDb };
