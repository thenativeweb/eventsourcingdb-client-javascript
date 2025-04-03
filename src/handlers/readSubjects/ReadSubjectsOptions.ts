import { validateSubject } from '../../event/validateSubject.js';

interface ReadSubjectsOptions {
	baseSubject: string;
}

const validateReadSubjectsOptions = (options: ReadSubjectsOptions): void => {
	validateSubject(options.baseSubject);
};

export type { ReadSubjectsOptions };
export { validateReadSubjectsOptions };
