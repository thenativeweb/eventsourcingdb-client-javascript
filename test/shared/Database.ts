import { ContainerizedTestingDatabase } from './ContainerizedTestingDatabase';
import { TestingDatabase } from './TestingDatabase';

interface Database {
	withAuthorization: ContainerizedTestingDatabase;
	withInvalidUrl: TestingDatabase;
}

export { Database };
