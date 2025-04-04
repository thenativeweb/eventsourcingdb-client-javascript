import { ValidationError } from '../util/error/ValidationError.js';

const wordPattern = '[0-9A-Za-z_-]+';
const subjectPattern = new RegExp(`^/(${wordPattern}/)*(${wordPattern}/?)?$`, 'u');

const validateSubject = (subject: string): void => {
	const didMatch = subjectPattern.test(subject);

	if (!didMatch) {
		throw new ValidationError(
			`Failed to validate subject: '${subject}' must be an absolute, slash-separated path.`,
		);
	}
};

export { validateSubject };
