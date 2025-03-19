import type { Database } from './Database.js';

const stopDatabase = (database: Database): void => {
	database.withAuthorization.stop();
};

export { stopDatabase };
