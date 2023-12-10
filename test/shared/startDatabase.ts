import { randomUUID } from 'crypto';
import { Client } from '../../lib';
import { ContainerizedTestingDatabase } from './ContainerizedTestingDatabase';
import { Database } from './Database';
import { TestingDatabase } from './TestingDatabase';
import { Image } from './docker/Image';

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
