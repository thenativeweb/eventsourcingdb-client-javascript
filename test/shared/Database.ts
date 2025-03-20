import type { ContainerizedTestingDatabase } from './ContainerizedTestingDatabase.js';
import type { TestingDatabase } from './TestingDatabase.js';

interface Database {
	withAuthorization: ContainerizedTestingDatabase;
	withInvalidUrl: TestingDatabase;
}

export type { Database };
