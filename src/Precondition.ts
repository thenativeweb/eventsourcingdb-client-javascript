interface IsSubjectPristinePrecondition {
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
			type: 'isEventQlQueryTrue';
			payload: IsEventQlQueryTruePrecondition;
	  };

export type { Precondition };
