import { Database } from './Database';
import { ContainerizedTestingDatabase } from './ContainerizedTestingDatabase';
import { Image } from './docker/Image';
import { randomUUID } from 'crypto';
import { TestingDatabase } from './TestingDatabase';
import { Client } from '../../lib';

const setup = async function (dockerfileDirectory: string): Promise<Database> {
	const image = new Image('eventsourcingdb', 'latest');
	image.build(dockerfileDirectory);

	const accessToken = randomUUID();
	const withAuthorization = await ContainerizedTestingDatabase.create(
		image,
		`server --dev --ui --access-token ${accessToken}`,
		{ accessToken },
	);
	const withoutAuthorization = await ContainerizedTestingDatabase.create(
		image,
		'server --dev --ui',
	);
	const withInvalidUrl = new TestingDatabase(new Client('http://localhost.invalid'));

	return {
		withAuthorization,
		withoutAuthorization,
		withInvalidUrl,
	};
};

export { setup };
