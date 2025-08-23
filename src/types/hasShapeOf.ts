import { isRecord } from './isRecord.js';

type Guard<T> = (x: unknown) => x is T;

type Shape<T> = {
	[K in keyof T]: T[K] extends object ? Shape<T[K]> | Guard<T[K]> : Guard<T[K]>;
};

const hasShapeOf = <T extends object>(value: unknown, shape: Shape<T>): value is T => {
	if (!isRecord(value)) {
		return false;
	}

	for (const key of Object.keys(shape) as Array<keyof T>) {
		const spec = shape[key] as unknown;
		const val = value[key as string];

		if (typeof spec === 'function') {
			const guard = spec as Guard<T[typeof key]>;

			if (!guard(val)) {
				return false;
			}

			continue;
		}

		if (!isRecord(val)) {
			return false;
		}

		if (
			!hasShapeOf<Extract<T[typeof key], object>>(
				val,
				spec as Shape<Extract<T[typeof key], object>>,
			)
		) {
			return false;
		}
	}

	return true;
};

export { hasShapeOf };
