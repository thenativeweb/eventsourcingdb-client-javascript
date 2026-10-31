import { isRecord } from './isRecord.js';

type Guard<T> = (x: unknown) => x is T;

type Shape<T> = {
	[K in keyof T]: T[K] extends object ? Shape<T[K]> | Guard<T[K]> : Guard<T[K]>;
};

const isGuard = (value: unknown): value is Guard<unknown> => typeof value === 'function';
const isShape = (value: unknown): value is Shape<object> => isRecord(value);

// A value matches a guard if the guard accepts it, and a nested shape if it is
// a record of that shape.
const matchesSpec = (value: unknown, spec: unknown): boolean => {
	if (isGuard(spec)) {
		return spec(value);
	}

	return isRecord(value) && isShape(spec) && hasShapeOf(value, spec);
};

const hasShapeOf = <T extends object>(value: unknown, shape: Shape<T>): value is T =>
	isRecord(value) && Object.entries(shape).every(([key, spec]) => matchesSpec(value[key], spec));

export { hasShapeOf };
