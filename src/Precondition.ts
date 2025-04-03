interface IsSubjectPristinePrecondition {
	subject: string;
}

interface IsSubjectOnEventIdPrecondition {
	subject: string;
	eventId: string;
}

type Precondition =
	| {
			type: 'isSubjectPristine';
			payload: IsSubjectPristinePrecondition;
	  }
	| {
			type: 'isSubjectOnEventId';
			payload: IsSubjectOnEventIdPrecondition;
	  };

const isSubjectPristine = (subject: string): Precondition => {
	return {
		type: 'isSubjectPristine',
		payload: { subject },
	};
};

const isSubjectOnEventId = (subject: string, eventId: string): Precondition => {
	return {
		type: 'isSubjectOnEventId',
		payload: { subject, eventId },
	};
};

export type { Precondition };
export { isSubjectPristine, isSubjectOnEventId };
