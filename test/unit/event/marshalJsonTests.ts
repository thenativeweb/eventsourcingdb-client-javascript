import { assert } from 'assertthat';
import { marshalJson } from '../../../lib/event/marshalJson';

suite('marshalJson', (): void => {
	test('do stuff.', async (): Promise<void> => {
		assert.that(marshalJson({ 2: 2 })).is.equalTo('{"2":2}');
		assert.that(marshalJson({ foo: 2 })).is.equalTo('{"foo":2}');
		assert.that(marshalJson({ bar: 'baz' })).is.equalTo('{"bar":"baz"}');
		assert.that(marshalJson({ true: { bar: 2, baz: undefined } })).is.equalTo('{"true":{"bar":2}}');
		assert
			.that(marshalJson({ true: { bar: 2, baz: [1, 2, 3, undefined, , undefined, 4] } }))
			.is.equalTo('{"true":{"bar":2,"baz":[1,2,3,null,null,null,4]}}');
		assert
			.that(() => {
				class Foo {}

				marshalJson(new Foo());
			})
			.is.throwing();
		assert
			.that(() => {
				class Foo {
					toJSON(): string {
						return 'foo';
					}
				}

				assert.that(marshalJson(new Foo())).is.equalTo('"foo"');
			})
			.is.not.throwing();
	});
});
