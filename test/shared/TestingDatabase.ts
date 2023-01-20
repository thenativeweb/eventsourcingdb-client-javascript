import { Client } from '../../lib';

class TestingDatabase {
	public readonly client: Client;

	constructor(client: Client) {
		this.client = client;
	}
}

export { TestingDatabase };
