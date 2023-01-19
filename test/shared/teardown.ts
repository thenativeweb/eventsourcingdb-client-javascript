import { Database } from './Database';

const teardown = async function (database: Database): Promise<void> {
	database.withAuthorization.stop();
	database.withoutAuthorization.stop();
};

export { teardown };
