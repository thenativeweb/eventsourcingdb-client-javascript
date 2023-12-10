type Precondition =
	| {
			type: 'isSubjectPristine';
			payload: IsSubjectPristinePrecondition;
	  }
	| {
			type: 'isSubjectOnEventId';
			payload: IsSubjectOnEventIdPrecondition;
	  };

interface IsSubjectPristinePrecondition {
	subject: string;
}

interface IsSubjectOnEventIdPrecondition {
	subject: string;
	eventId: string;
}

const isSubjectPristine = (payload: IsSubjectPristinePrecondition): Precondition => {
	return {
		type: 'isSubjectPristine',
		payload,
	};
};

const isSubjectOnEventId = (payload: IsSubjectOnEventIdPrecondition): Precondition => {
	return {
		type: 'isSubjectOnEventId',
		payload,
	};
};

export { Precondition, isSubjectPristine, isSubjectOnEventId };
