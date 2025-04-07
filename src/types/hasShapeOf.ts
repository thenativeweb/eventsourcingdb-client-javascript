// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This function has a high complecity, but it is not possible to reduce it without changing the logic.
const hasShapeOf = <T>(value: unknown, blueprint: T): value is T => {
	if (typeof blueprint !== typeof value) {
		return false;
	}

	if (blueprint === null || value === null) {
		return blueprint === null && value === null;
	}

	if (typeof blueprint === 'object') {
		if (Array.isArray(blueprint) || Array.isArray(value)) {
			return false;
		}

		const blueprintObject = blueprint as Record<string, unknown>;
		const valueObject = value as Record<string, unknown>;

		for (const key of Object.keys(blueprintObject)) {
			if (!(key in valueObject)) {
				return false;
			}
			if (!hasShapeOf(valueObject[key], blueprintObject[key])) {
				return false;
			}
		}

		return true;
	}

	return true;
};

export { hasShapeOf };
