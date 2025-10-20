interface IsSubjectPristinePrecondition {
	subject: string;
}

interface IsSubjectPopulatedPrecondition {
	subject: string;
}

interface IsSubjectOnEventIdPrecondition {
	subject: string;
	eventId: string;
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
