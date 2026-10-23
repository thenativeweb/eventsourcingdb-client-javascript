import type { PreconditionOptions } from './PreconditionOptions.js';

// Returns the options as part of the payload of a precondition. It leaves them
// out unless the caller passes them, since a server whose v2 API does not know
// them refuses them as an unknown field. It takes them as the caller passed
// them, so that the server refuses a misspelled key, rather than check less
// than was asked.
const withPreconditionOptions = (
	options: PreconditionOptions | undefined,
): { options?: PreconditionOptions } => (options === undefined ? {} : { options });

export { withPreconditionOptions };
