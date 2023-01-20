import { Client } from '../../lib';

class TestingDatabase {
	private readonly client: Client;

	constructor(client: Client) {
		this.client = client;
	}

	public async getClient(): Promise<Client> {
		return this.client;
	}
}

export { TestingDatabase };
