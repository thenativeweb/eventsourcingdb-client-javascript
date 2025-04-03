import { randomUUID } from 'node:crypto';
import { Client } from '../../src/index.js';
import { ContainerizedTestingDatabase } from './ContainerizedTestingDatabase.js';
import type { Database } from './Database.js';
import { TestingDatabase } from './TestingDatabase.js';
import { Image } from './docker/Image.js';

const startDatabase = async (): Promise<Database> => {
	const image = new Image('eventsourcingdb', 'latest');

	const accessToken = randomUUID();
	const withAuthorization = await ContainerizedTestingDatabase.create(
		image,
		`run --ui --access-token ${accessToken} --store-temporary`,
		{ accessToken },
	);
	const withInvalidUrl = new TestingDatabase(
		new Client('http://localhost.invalid', { accessToken }),
	);

	return {
		withAuthorization,
		withInvalidUrl,
	};
};

export { startDatabase };
