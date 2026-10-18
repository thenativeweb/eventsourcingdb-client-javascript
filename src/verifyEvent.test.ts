import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { suite, test } from 'node:test';
import { convertCloudEventToEvent } from './convertCloudEventToEvent.js';
import type { Event } from './Event.js';
import { HashVerificationFailedError } from './HashVerificationFailedError.js';
import { isCloudEvent } from './isCloudEvent.js';
import { SignatureVerificationFailedError } from './SignatureVerificationFailedError.js';
import { UnsupportedHashVersionError } from './UnsupportedHashVersionError.js';

// The events that EventSourcingDB uses as its own fixtures for both versions
// of the hash, as its API sends them, byte for byte. The second one of each
// carries a trace context and data that a JSON library would serialize
// differently: the server escapes & and <, and nanos is larger than a safe
// integer.
const fixtures = {
	'version 1': [
		'{"source":"tag:thenativeweb.io,2023:library","subject":"/","type":"io.eventsourcingdb.library.book-acquired","specversion":"1.0","id":"0","time":"2026-10-13T12:00:00Z","datacontenttype":"application/json","predecessorhash":"0000000000000000000000000000000000000000000000000000000000000000","data":{},"hash":"eb04f1ac44859220f999560512a6d8067fade3c8e3cd59a5fbeb4cf30c8428f6","signature":null}',
		'{"source":"tag:thenativeweb.io,2023:library","subject":"/books/42","type":"io.eventsourcingdb.library.book-acquired","traceparent":"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01","tracestate":"vendor=value","specversion":"1.0","id":"1","time":"2026-10-13T12:00:00.123456789Z","datacontenttype":"application/json","predecessorhash":"eb04f1ac44859220f999560512a6d8067fade3c8e3cd59a5fbeb4cf30c8428f6","data":{"copies":3,"isbn":"978-0756906788","meta":{"shelf":"A\\u0026B"},"nanos":9007199254740993,"price":12.5,"tags":["sf","\\u003cclassic\\u003e"],"title":"2001 – A Space Odyssey"},"hash":"82c1ccb26afe7554ede4478a0f5c89f9dd1f5fcf995f3602ddf149edd7aec159","signature":null}',
	],
	'version 2': [
		'{"source":"tag:thenativeweb.io,2023:library","subject":"/","type":"io.eventsourcingdb.library.book-acquired","specversion":"1.0","id":"0","time":"2026-10-13T12:00:00Z","datacontenttype":"application/json","predecessorhash":"0000000000000000000000000000000000000000000000000000000000000000","data":{},"hash":"esdb:hash:v2:84a2a7e52e0f5b0b2d26e37a291835c8f8041e9d3a1f1b06f955f50818a9e182","signature":null}',
		'{"source":"tag:thenativeweb.io,2023:library","subject":"/books/42","type":"io.eventsourcingdb.library.book-acquired","traceparent":"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01","tracestate":"vendor=value","specversion":"1.0","id":"1","time":"2026-10-13T12:00:00.123456789Z","datacontenttype":"application/json","predecessorhash":"esdb:hash:v2:84a2a7e52e0f5b0b2d26e37a291835c8f8041e9d3a1f1b06f955f50818a9e182","data":{"copies":3,"isbn":"978-0756906788","meta":{"shelf":"A\\u0026B"},"nanos":9007199254740993,"price":12.5,"tags":["sf","\\u003cclassic\\u003e"],"title":"2001 – A Space Odyssey"},"hash":"esdb:hash:v2:f7ba6e6d8dc17c50c0dfc8663228b6aaa3345ddd8d0b70d6dcb5deb23ab34da6","signature":null}',
	],
};

const getEvent = (text: string): Event => {
	const cloudEvent: unknown = JSON.parse(text);
	if (!isCloudEvent(cloudEvent)) {
		throw new Error('Fixture must be a cloud event.');
	}

	return convertCloudEventToEvent(cloudEvent, text);
};

// The server signs the text of the hash, including its prefix, if it has one.
const getSignedEvent = (text: string, signingKey: crypto.KeyObject): Event => {
	const event = getEvent(text);
	const signature = crypto.sign(null, Buffer.from(event.hash, 'utf8'), signingKey).toString('hex');
	event.signature = `esdb:signature:v1:${signature}`;

	return event;
};

// Changing the source invalidates a hash of any version.
const tamper = (text: string): string => text.replace('"source":"tag:', '"source":"urn:');

const hashOfUnknownVersion = `esdb:hash:v3:${'0'.repeat(64)}`;

suite('verifyEvent', (): void => {
	suite('verifyHash', (): void => {
		for (const [version, texts] of Object.entries(fixtures)) {
			test(`verifies a hash of ${version}.`, (): void => {
				for (const text of texts) {
					const event = getEvent(text);

					assert.doesNotThrow((): void => {
						event.verifyHash();
					});
				}
			});

			test(`throws an error if a hash of ${version} is invalid.`, (): void => {
				for (const text of texts) {
					const event = getEvent(tamper(text));

					assert.throws(
						(): void => {
							event.verifyHash();
						},
						error => {
							assert.ok(error instanceof HashVerificationFailedError);
							assert.ok(error instanceof Error);
							assert.equal(error.name, 'HashVerificationFailedError');
							assert.equal(error.message, 'Failed to verify hash.');
							return true;
						},
					);
				}
			});
		}

		for (const [version, texts] of Object.entries(fixtures)) {
			test(`throws an error if the data of an event with a hash of ${version} has been changed.`, (): void => {
				for (const text of texts) {
					const event = getEvent(text);
					event.data.isbn = '978-0000000000';

					assert.throws((): void => {
						event.verifyHash();
					}, HashVerificationFailedError);
				}
			});
		}

		test('covers the trace context in a hash of version 2, but not in one of version 1.', (): void => {
			const [, textOfVersion1] = fixtures['version 1'];
			const [, textOfVersion2] = fixtures['version 2'];
			assert.ok(textOfVersion1);
			assert.ok(textOfVersion2);

			const eventOfVersion1 = getEvent(textOfVersion1.replace('vendor=value', 'vendor=other'));
			const eventOfVersion2 = getEvent(textOfVersion2.replace('vendor=value', 'vendor=other'));

			assert.doesNotThrow((): void => {
				eventOfVersion1.verifyHash();
			});
			assert.throws((): void => {
				eventOfVersion2.verifyHash();
			}, HashVerificationFailedError);
		});

		test('throws an error that names the version if the hash is of an unknown version.', (): void => {
			const [text] = fixtures['version 2'];
			assert.ok(text);

			const event = getEvent(text);
			event.hash = hashOfUnknownVersion;

			assert.throws(
				(): void => {
					event.verifyHash();
				},
				error => {
					assert.ok(error instanceof UnsupportedHashVersionError);
					assert.ok(error instanceof Error);
					assert.ok(!(error instanceof HashVerificationFailedError));
					assert.equal(error.name, 'UnsupportedHashVersionError');
					assert.equal(error.message, "Hash version 'v3' is not supported.");
					return true;
				},
			);
		});
	});

	suite('verifySignature', (): void => {
		const { privateKey: signingKey, publicKey: verificationKey } =
			crypto.generateKeyPairSync('ed25519');

		for (const [version, texts] of Object.entries(fixtures)) {
			test(`verifies the signature of an event with a hash of ${version}.`, (): void => {
				for (const text of texts) {
					const event = getSignedEvent(text, signingKey);

					assert.doesNotThrow((): void => {
						event.verifySignature(verificationKey);
					});
				}
			});

			test(`throws an error if the signature of an event with a hash of ${version} is invalid.`, (): void => {
				const { publicKey: otherVerificationKey } = crypto.generateKeyPairSync('ed25519');

				for (const text of texts) {
					const event = getSignedEvent(text, signingKey);

					assert.throws(
						(): void => {
							event.verifySignature(otherVerificationKey);
						},
						error => {
							assert.ok(error instanceof SignatureVerificationFailedError);
							assert.ok(error instanceof Error);
							assert.equal(error.name, 'SignatureVerificationFailedError');
							assert.equal(error.message, 'Signature verification failed.');
							return true;
						},
					);
				}
			});

			test(`throws an error if the hash of ${version} of a signed event is invalid.`, (): void => {
				for (const text of texts) {
					const event = getSignedEvent(tamper(text), signingKey);

					assert.throws((): void => {
						event.verifySignature(verificationKey);
					}, HashVerificationFailedError);
				}
			});
		}

		test('throws an error that names the version if the hash is of an unknown version.', (): void => {
			const [text] = fixtures['version 2'];
			assert.ok(text);

			const event = getEvent(text);
			event.hash = hashOfUnknownVersion;
			event.signature = `esdb:signature:v1:${crypto.sign(null, Buffer.from(event.hash, 'utf8'), signingKey).toString('hex')}`;

			assert.throws((): void => {
				event.verifySignature(verificationKey);
			}, UnsupportedHashVersionError);
		});
	});
});
