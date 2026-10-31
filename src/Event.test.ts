import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterEach, beforeEach, suite, test } from 'node:test';
import type { Client } from './Client.js';
import { Container } from './Container.js';
import type { Event } from './Event.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageTag } from './getImageTag.js';
import { HashVerificationFailedError } from './HashVerificationFailedError.js';
import { SignatureVerificationFailedError } from './SignatureVerificationFailedError.js';
import { containerStartTimeout } from './testing/containerStartTimeout.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

// Returns an event as written, as read, and as observed. Its data contains
// characters that the server escapes, and it carries a trace context.
const writeReadAndObserveEvent = async (client: Client): Promise<Event[]> => {
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

	const events = await client.writeEvents([event]);

	for await (const item of client.readEvents('/test', { recursive: false })) {
		events.push(item);
	}

	for await (const item of client.observeEvents('/test', { recursive: false })) {
		events.push(item);
		break;
	}

	return events;
};

suite('Event', () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
		await container.start();
	}, containerStartTimeout);

	afterEach(async () => {
		await container.stop();
	}, integrationTimeout);

	suite('verifyHash', (): void => {
		test('verifies the event hash.', integrationTimeout, async (): Promise<void> => {
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

		test(
			'verifies the hash of an event as written, read, and observed, whatever its data and trace context.',
			integrationTimeout,
			async (): Promise<void> => {
				const client = container.getClient();

				const events = await writeReadAndObserveEvent(client);
				assert.equal(events.length, 3);

				for (const event of events) {
					assert.doesNotThrow((): void => {
						event.verifyHash();
					});
				}
			},
		);

		test(
			'throws an error if the event hash is invalid.',
			integrationTimeout,
			async (): Promise<void> => {
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
			},
		);
	});

	suite('verifySignature', (): void => {
		test(
			'throws an error if the signature is null.',
			integrationTimeout,
			async (): Promise<void> => {
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
			},
		);

		test(
			'throws an error if the hash verification fails.',
			containerStartTimeout,
			// biome-ignore lint/nursery/noExcessiveStatementsPerFunction: The test is one linear sequence of steps, and splitting it would make it harder to follow.
			async (): Promise<void> => {
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
			},
		);

		test(
			'throws an error if the signature verification fails.',
			containerStartTimeout,
			// biome-ignore lint/nursery/noExcessiveStatementsPerFunction: The test is one linear sequence of steps, and splitting it would make it harder to follow.
			async (): Promise<void> => {
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
			},
		);

		// biome-ignore lint/nursery/noExcessiveStatementsPerFunction: The test is one linear sequence of steps, and splitting it would make it harder to follow.
		test('verifies the signature.', containerStartTimeout, async (): Promise<void> => {
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

		test(
			'verifies the signature of an event as written, read, and observed, whatever its data and trace context.',
			containerStartTimeout,
			// biome-ignore lint/nursery/noExcessiveStatementsPerFunction: The test is one linear sequence of steps, and splitting it would make it harder to follow.
			async (): Promise<void> => {
				await container.stop();
				const imageTag = getImageTag();
				container = new Container().withImageTag(imageTag).withSigningKey();
				await container.start();

				const client = container.getClient();
				const verificationKey = container.getVerificationKey();

				const events = await writeReadAndObserveEvent(client);
				assert.equal(events.length, 3);

				for (const event of events) {
					assert.notEqual(event.signature, null);
					assert.doesNotThrow((): void => {
						event.verifySignature(verificationKey);
					});
				}
			},
		);
	});
});
