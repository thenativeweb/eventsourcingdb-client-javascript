import { validateSubject } from '../../event/validateSubject';

interface ReadSubjectsOptions {
	baseSubject: string;
}

const validateReadSubjectsOptions = (options: ReadSubjectsOptions): void => {
	validateSubject(options.baseSubject);
};

export { ReadSubjectsOptions, validateReadSubjectsOptions };
