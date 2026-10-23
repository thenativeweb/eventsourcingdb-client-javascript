import type { PreconditionOptions } from './PreconditionOptions.js';

interface IsSubjectPristinePrecondition {
	subject: string;
	options?: PreconditionOptions;
}

interface IsSubjectPopulatedPrecondition {
	subject: string;
	options?: PreconditionOptions;
}

interface IsSubjectOnEventIdPrecondition {
	subject: string;
	eventId: string;
	options?: PreconditionOptions;
}

interface IsEventQlQueryTruePrecondition {
	query: string;
}

type Precondition =
	| {
			type: 'isSubjectPristine';
			payload: IsSubjectPristinePrecondition;
	  }
	| {
			type: 'isSubjectOnEventId';
			payload: IsSubjectOnEventIdPrecondition;
	  }
	| {
			type: 'isSubjectPopulated';
			payload: IsSubjectPopulatedPrecondition;
	  }
	| {
			type: 'isEventQlQueryTrue';
			payload: IsEventQlQueryTruePrecondition;
	  };

export type { Precondition };
