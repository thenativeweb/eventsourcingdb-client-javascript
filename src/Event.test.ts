import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageVersionFromDockerfile } from './getImageVersionFromDockerfile.js';

suite('Event', { timeout: 30_000 }, () => {
	let container: Container;

	beforeEach(async () => {
		const imageVersion = getImageVersionFromDockerfile();
		container = new Container().withImageTag(imageVersion);
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

			assert.doesNotThrow((): void => {
				writtenEvent.verifyHash();
			});
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

			const invalidHash = crypto.createHash('sha256').update('invalid hash').digest('hex');
			writtenEvent.hash = invalidHash;

			assert.throws((): void => {
				writtenEvent.verifyHash();
			});
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
			assert.equal(writtenEvent.signature, null);

			const { publicKey: verificationKey } = crypto.generateKeyPairSync('ed25519');

			assert.throws((): void => {
				writtenEvent.verifySignature(verificationKey);
			});
		});

		test('throws an error if the hash verification fails.', async (): Promise<void> => {
			await container.stop();
			const imageVersion = getImageVersionFromDockerfile();
			container = new Container().withImageTag(imageVersion).withSigningKey();
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
			assert.notEqual(writtenEvent.signature, null);

			const invalidHash = crypto.createHash('sha256').update('invalid hash').digest('hex');
			writtenEvent.hash = invalidHash;

			const verificationKey = container.getVerificationKey();

			assert.throws((): void => {
				writtenEvent.verifySignature(verificationKey);
			});
		});

		test('throws an error if the signature verification fails.', async (): Promise<void> => {
			await container.stop();
			const imageVersion = getImageVersionFromDockerfile();
			container = new Container().withImageTag(imageVersion).withSigningKey();
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
			assert.notEqual(writtenEvent.signature, null);

			writtenEvent.signature += '0123456789abcdef';

			const verificationKey = container.getVerificationKey();

			assert.throws((): void => {
				writtenEvent.verifySignature(verificationKey);
			});
		});

		test('verifies the signature.', async (): Promise<void> => {
			await container.stop();
			const imageVersion = getImageVersionFromDockerfile();
			container = new Container().withImageTag(imageVersion).withSigningKey();
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
			assert.notEqual(writtenEvent.signature, null);

			const verificationKey = container.getVerificationKey();

			assert.doesNotThrow((): void => {
				writtenEvent.verifySignature(verificationKey);
			});
		});
	});
});
