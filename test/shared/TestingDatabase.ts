import type { Client } from '../../lib/index.js';

class TestingDatabase {
	public readonly client: Client;

	public constructor(client: Client) {
		this.client = client;
	}
}

export { TestingDatabase };
