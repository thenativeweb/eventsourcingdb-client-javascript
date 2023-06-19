import { Database } from './Database';

const stopDatabase = async function (database: Database): Promise<void> {
	database.withAuthorization.stop();
};

export { stopDatabase };
