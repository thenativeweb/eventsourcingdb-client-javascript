const wordPattern = '[0-9A-Za-z_-]+';
const subjectPattern = new RegExp(`^/(${wordPattern}/)*(${wordPattern}/?)?$`, 'u');

const validateSubject = function (subject: string): void {
	const didMatch = subjectPattern.test(subject);

	if (!didMatch) {
		throw new Error(
			`Malformed event subject, '${subject}' must be an absolute, slash-separated path.`,
		);
	}
};

export { validateSubject };
