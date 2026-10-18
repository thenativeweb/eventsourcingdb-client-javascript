import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { convertCloudEventToEvent } from './convertCloudEventToEvent.js';
import type { Event } from './Event.js';
import { isCloudEvent } from './isCloudEvent.js';

// The events that EventSourcingDB uses as its own fixtures for both versions
// of the hash, as its API sends them, byte for byte. The second one carries a
// trace context and data that a JSON library would serialize differently: the
// server escapes & and <, and nanos is larger than a safe integer.
const fixtures = {
	version1: [
		'{"source":"tag:thenativeweb.io,2023:library","subject":"/","type":"io.eventsourcingdb.library.book-acquired","specversion":"1.0","id":"0","time":"2026-10-13T12:00:00Z","datacontenttype":"application/json","predecessorhash":"0000000000000000000000000000000000000000000000000000000000000000","data":{},"hash":"eb04f1ac44859220f999560512a6d8067fade3c8e3cd59a5fbeb4cf30c8428f6","signature":null}',
		'{"source":"tag:thenativeweb.io,2023:library","subject":"/books/42","type":"io.eventsourcingdb.library.book-acquired","traceparent":"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01","tracestate":"vendor=value","specversion":"1.0","id":"1","time":"2026-10-13T12:00:00.123456789Z","datacontenttype":"application/json","predecessorhash":"eb04f1ac44859220f999560512a6d8067fade3c8e3cd59a5fbeb4cf30c8428f6","data":{"copies":3,"isbn":"978-0756906788","meta":{"shelf":"A\\u0026B"},"nanos":9007199254740993,"price":12.5,"tags":["sf","\\u003cclassic\\u003e"],"title":"2001 – A Space Odyssey"},"hash":"82c1ccb26afe7554ede4478a0f5c89f9dd1f5fcf995f3602ddf149edd7aec159","signature":null}',
	],
};

const getEvent = (text: string): Event => {
	const cloudEvent: unknown = JSON.parse(text);
	if (!isCloudEvent(cloudEvent)) {
		throw new Error('Fixture must be a cloud event.');
	}

	return convertCloudEventToEvent(cloudEvent, text);
};

suite('verifyEvent', (): void => {
	suite('verifyHash', (): void => {
		test('verifies a hash of version 1.', (): void => {
			for (const text of fixtures.version1) {
				const event = getEvent(text);

				assert.doesNotThrow((): void => {
					event.verifyHash();
				});
			}
		});

		test('throws an error if a hash of version 1 is invalid.', (): void => {
			for (const text of fixtures.version1) {
				const event = getEvent(text.replace('"source":"tag:', '"source":"urn:'));

				assert.throws(
					(): void => {
						event.verifyHash();
					},
					error => {
						assert.ok(error instanceof Error);
						assert.equal(error.message, 'Failed to verify hash.');
						return true;
					},
				);
			}
		});
	});
});
