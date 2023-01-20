import { Database } from './Database';

const stopDatabase = async function (database: Database): Promise<void> {
	database.withAuthorization.stop();
	database.withoutAuthorization.stop();
};

export { stopDatabase };
