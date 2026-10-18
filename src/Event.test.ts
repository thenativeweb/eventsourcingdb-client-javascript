import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageTag } from './getImageTag.js';
import { HashVerificationFailedError } from './HashVerificationFailedError.js';
import { SignatureVerificationFailedError } from './SignatureVerificationFailedError.js';

suite('Event', { timeout: 30_000 }, () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
		await container.start();
	});

	afterEach(async () => {
		await container.stop();
	});

	suite('verifyHash', (): void => {
		test('verifies the event hash.', async (): Promise<void> => {
			const client = container.getClient();

			const event: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test',
				type: 'io.eventsourcingdb.test',
				data: {
					value: 23,
				},
			};

			const writtenEvents = await client.writeEvents([event]);

			assert.equal(writtenEvents.length, 1);

			const writtenEvent = writtenEvents[0];
			assert.ok(writtenEvent);

			assert.doesNotThrow((): void => {
				writtenEvent.verifyHash();
			});
		});

		test('verifies the hash of an event as written, read, and observed, whatever its data and trace context.', async (): Promise<void> => {
			const client = container.getClient();

			const event: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test',
				type: 'io.eventsourcingdb.test',
				data: {
					title: '2001 – A Space Odyssey',
					tags: ['<classic>'],
					shelf: 'A&B',
					price: 12.5,
				},
				traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
				tracestate: 'vendor=value',
			};

			const [writtenEvent] = await client.writeEvents([event]);
			assert.ok(writtenEvent);

			let readEvent: Event | undefined;
			for await (const item of client.readEvents('/test', { recursive: false })) {
				readEvent = item;
			}
			assert.ok(readEvent);

			let observedEvent: Event | undefined;
			for await (const item of client.observeEvents('/test', { recursive: false })) {
				observedEvent = item;
				break;
			}
			assert.ok(observedEvent);

			for (const item of [writtenEvent, readEvent, observedEvent]) {
				assert.doesNotThrow((): void => {
					item.verifyHash();
				});
			}
		});

		test('throws an error if the event hash is invalid.', async (): Promise<void> => {
			const client = container.getClient();

			const event: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test',
				type: 'io.eventsourcingdb.test',
				data: {
					value: 23,
				},
			};

			const writtenEvents = await client.writeEvents([event]);

			assert.equal(writtenEvents.length, 1);

			const writtenEvent = writtenEvents[0];
			assert.ok(writtenEvent);

			const invalidHash = crypto.createHash('sha256').update('invalid hash').digest('hex');
			writtenEvent.hash = invalidHash;

			assert.throws((): void => {
				writtenEvent.verifyHash();
			}, HashVerificationFailedError);
		});
	});

	suite('verifySignature', (): void => {
		test('throws an error if the signature is null.', async (): Promise<void> => {
			const client = container.getClient();

			const event: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test',
				type: 'io.eventsourcingdb.test',
				data: {
					value: 23,
				},
			};

			const writtenEvents = await client.writeEvents([event]);

			assert.equal(writtenEvents.length, 1);

			const writtenEvent = writtenEvents[0];
			assert.ok(writtenEvent);
			assert.equal(writtenEvent.signature, null);

			const { publicKey: verificationKey } = crypto.generateKeyPairSync('ed25519');

			assert.throws((): void => {
				writtenEvent.verifySignature(verificationKey);
			});
		});

		test('throws an error if the hash verification fails.', async (): Promise<void> => {
			await container.stop();
			const imageTag = getImageTag();
			container = new Container().withImageTag(imageTag).withSigningKey();
			await container.start();

			const client = container.getClient();

			const event: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test',
				type: 'io.eventsourcingdb.test',
				data: {
					value: 23,
				},
			};

			const writtenEvents = await client.writeEvents([event]);

			assert.equal(writtenEvents.length, 1);

			const writtenEvent = writtenEvents[0];
			assert.ok(writtenEvent);
			assert.notEqual(writtenEvent.signature, null);

			const invalidHash = crypto.createHash('sha256').update('invalid hash').digest('hex');
			writtenEvent.hash = invalidHash;

			const verificationKey = container.getVerificationKey();

			assert.throws((): void => {
				writtenEvent.verifySignature(verificationKey);
			}, HashVerificationFailedError);
		});

		test('throws an error if the signature verification fails.', async (): Promise<void> => {
			await container.stop();
			const imageTag = getImageTag();
			container = new Container().withImageTag(imageTag).withSigningKey();
			await container.start();

			const client = container.getClient();

			const event: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test',
				type: 'io.eventsourcingdb.test',
				data: {
					value: 23,
				},
			};

			const writtenEvents = await client.writeEvents([event]);

			assert.equal(writtenEvents.length, 1);

			const writtenEvent = writtenEvents[0];
			assert.ok(writtenEvent);
			assert.notEqual(writtenEvent.signature, null);

			writtenEvent.signature += '0123456789abcdef';

			const verificationKey = container.getVerificationKey();

			assert.throws((): void => {
				writtenEvent.verifySignature(verificationKey);
			}, SignatureVerificationFailedError);
		});

		test('verifies the signature.', async (): Promise<void> => {
			await container.stop();
			const imageTag = getImageTag();
			container = new Container().withImageTag(imageTag).withSigningKey();
			await container.start();

			const client = container.getClient();

			const event: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test',
				type: 'io.eventsourcingdb.test',
				data: {
					value: 23,
				},
			};

			const writtenEvents = await client.writeEvents([event]);

			assert.equal(writtenEvents.length, 1);

			const writtenEvent = writtenEvents[0];
			assert.ok(writtenEvent);
			assert.notEqual(writtenEvent.signature, null);

			const verificationKey = container.getVerificationKey();

			assert.doesNotThrow((): void => {
				writtenEvent.verifySignature(verificationKey);
			});
		});
	});
});
