interface IsSubjectPristinePrecondition {
	subject: string;
}

interface IsSubjectOnEventIdPrecondition {
	subject: string;
	eventId: string;
}

interface IsEventQlTruePrecondition {
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
			type: 'isEventQlTrue';
			payload: IsEventQlTruePrecondition;
	  };

export type { Precondition };
