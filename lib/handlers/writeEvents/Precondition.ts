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

const isSubjectPristine = function (payload: IsSubjectPristinePrecondition): Precondition {
	return {
		type: 'isSubjectPristine',
		payload,
	};
};

const isSubjectOnEventId = function (payload: IsSubjectOnEventIdPrecondition): Precondition {
	return {
		type: 'isSubjectOnEventId',
		payload,
	};
};

export { Precondition, isSubjectPristine, isSubjectOnEventId };
