import { Database } from './Database';

const stopDatabase = async (database: Database): Promise<void> => {
	database.withAuthorization.stop();
};

export { stopDatabase };
