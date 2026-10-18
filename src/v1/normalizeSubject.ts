const leadingAndTrailingSlashes = /^\/+|\/+$/gu;

// Returns the subject as the server keeps it, which is a slash followed by
// the subject without its leading and trailing slashes, so '/test/' becomes
// '/test', and '/' stays '/'.
const normalizeSubject = (subject: string): string =>
	`/${subject.replaceAll(leadingAndTrailingSlashes, '')}`;

export { normalizeSubject };
