import { ContainerizedTestingDatabase } from './ContainerizedTestingDatabase';
import { TestingDatabase } from './TestingDatabase';

interface Database {
	withAuthorization: ContainerizedTestingDatabase;
	withoutAuthorization: ContainerizedTestingDatabase;
	withInvalidUrl: TestingDatabase;
}

export { Database };
