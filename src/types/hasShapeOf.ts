import { isRecord } from './isRecord.js';

type Guard<T> = (x: unknown) => x is T;

type Shape<T> = {
	[K in keyof T]: T[K] extends object ? Shape<T[K]> | Guard<T[K]> : Guard<T[K]>;
};

const isGuard = (value: unknown): value is Guard<unknown> => typeof value === 'function';
const isShape = (value: unknown): value is Shape<object> => isRecord(value);

const hasShapeOf = <T extends object>(value: unknown, shape: Shape<T>): value is T => {
	if (!isRecord(value)) {
		return false;
	}

	for (const [key, spec] of Object.entries(shape)) {
		const val = value[key];

		if (isGuard(spec)) {
			if (!spec(val)) {
				return false;
			}

			continue;
		}

		if (!(isRecord(val) && isShape(spec))) {
			return false;
		}

		if (!hasShapeOf(val, spec)) {
			return false;
		}
	}

	return true;
};

export { hasShapeOf };
