import { Client } from '../../lib';
import { ContainerizedTestingDatabase } from './ContainerizedTestingDatabase';
import { Database } from './Database';
import { TestingDatabase } from './TestingDatabase';
import { Image } from './docker/Image';
import { randomUUID } from 'crypto';

const startDatabase = async function (): Promise<Database> {
	const image = new Image('eventsourcingdb', 'latest');

	const accessToken = randomUUID();
	const withAuthorization = await ContainerizedTestingDatabase.create(
		image,
		`run --dev --ui --access-token ${accessToken}`,
		{ accessToken },
	);
	const withoutAuthorization = await ContainerizedTestingDatabase.create(image, 'run --dev --ui');
	const withInvalidUrl = new TestingDatabase(new Client('http://localhost.invalid'));

	return {
		withAuthorization,
		withoutAuthorization,
		withInvalidUrl,
	};
};

export { startDatabase };
