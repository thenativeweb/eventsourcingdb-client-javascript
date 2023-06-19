import { validateSubject } from '../../event/validateSubject';

interface ReadSubjectsOptions {
	baseSubject: string;
}

const validateReadSubjectsOptions = function (options: ReadSubjectsOptions): void {
	validateSubject(options.baseSubject);
};

export { ReadSubjectsOptions, validateReadSubjectsOptions };
