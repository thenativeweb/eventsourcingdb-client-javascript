import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { hasShapeOf } from './hasShapeOf.js';

suite('hasShapeOf', (): void => {
	test('returns true for the same primitive type.', (): void => {
		const object = 'foo';
		const shape = 'bar';
		assert.ok(hasShapeOf(object, shape));
	});

	test('returns false for different primitive types.', (): void => {
		const object = 'foo';
		const shape = 42;
		assert.ok(!hasShapeOf(object, shape));
	});

	test('returns true if the object has the shape.', (): void => {
		const object = { type: 'foo' };
		const shape = { type: 'bar' };
		assert.ok(hasShapeOf(object, shape));
	});

	test('returns false if the object does not have the shape.', (): void => {
		const object = { type: 'foo' };
		const shape = { type: 42 };
		assert.ok(!hasShapeOf(object, shape));
	});

	test('returns false if the object is null.', (): void => {
		const object: null = null;
		const shape = { type: 'foo' };
		assert.ok(!hasShapeOf(object, shape));
	});
});
