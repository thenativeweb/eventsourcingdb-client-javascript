import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { hasShapeOf } from './hasShapeOf.js';
import { isBoolean } from './isBoolean.js';
import { isString } from './isString.js';

interface Shape {
	foo: string;
	bar: boolean;
}

suite('hasShapeOf', (): void => {
	test('returns true for matching shapes.', (): void => {
		assert.ok(
			hasShapeOf<Shape>(
				{ foo: 'foo', bar: true },
				{
					foo: isString,
					bar: isBoolean,
				},
			),
		);
	});

	test('returns false for non-matching shapes.', (): void => {
		assert.ok(
			!hasShapeOf<Shape>(
				{ foo: 'foo', bar: 42 },
				{
					foo: isString,
					bar: isBoolean,
				},
			),
		);
	});

	test('returns false if the object is null.', (): void => {
		assert.ok(
			!hasShapeOf<Shape>(null, {
				foo: isString,
				bar: isBoolean,
			}),
		);
	});
});
