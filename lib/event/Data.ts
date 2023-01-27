import { UnknownObject } from '../util/UnknownObject';

type Data =
	| UnknownObject
	| {
			toJSON(): unknown;
	  };

export { Data };
