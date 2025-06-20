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
			type: 'isEventQLTrue';
			payload: IsEventQlTruePrecondition;
	  };

export type { Precondition };
