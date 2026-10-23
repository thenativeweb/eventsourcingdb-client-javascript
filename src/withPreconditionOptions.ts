import type { PreconditionOptions } from './PreconditionOptions.js';

// Returns the options as part of the payload of a precondition. It leaves them
// out unless the caller passes them, since a server whose v2 API does not know
// them refuses them as an unknown field, and it takes only the fields that the
// server knows, as the bodies of the requests of the v2 API do.
const withPreconditionOptions = (
	options: PreconditionOptions | undefined,
): { options?: PreconditionOptions } =>
	options === undefined ? {} : { options: { recursive: options.recursive } };

export { withPreconditionOptions };
