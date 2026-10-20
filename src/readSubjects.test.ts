import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageTag } from './getImageTag.js';
import { containerStartTimeout } from './testing/containerStartTimeout.js';
import { integrationTimeout } from './testing/integrationTimeout.js';

suite('readSubjects', () => {
	let container: Container;

	beforeEach(async () => {
		const imageTag = getImageTag();
		container = new Container().withImageTag(imageTag);
		await container.start();
	}, containerStartTimeout);

	afterEach(async () => {
		await container.stop();
	}, integrationTimeout);

	test(
		'reads no subjects if the database is empty.',
		integrationTimeout,
		async (): Promise<void> => {
			const client = container.getClient();

			let didReadSubjects = false;
			for await (const _event of client.readSubjects('/', { recursive: true })) {
				didReadSubjects = true;
			}

			assert.equal(didReadSubjects, false);
		},
	);

	test('reads all subjects.', integrationTimeout, async (): Promise<void> => {
		const client = container.getClient();

		const firstEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/1',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 23,
			},
		};

		const secondEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/2',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 42,
			},
		};

		await client.writeEvents([firstEvent, secondEvent]);

		const subjectsRead: string[] = [];
		for await (const subject of client.readSubjects('/', { recursive: true })) {
			subjectsRead.push(subject);
		}

		assert.equal(subjectsRead.length, 4);
		assert.equal(subjectsRead[0], '/');
		assert.equal(subjectsRead[1], '/test');
		assert.equal(subjectsRead[2], '/test/1');
		assert.equal(subjectsRead[3], '/test/2');
	});

	test('reads all subjects from the subject.', integrationTimeout, async (): Promise<void> => {
		const client = container.getClient();

		const firstEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/1',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 23,
			},
		};

		const secondEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test/2',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 42,
			},
		};

		await client.writeEvents([firstEvent, secondEvent]);

		const subjectsRead: string[] = [];
		for await (const subject of client.readSubjects('/test', { recursive: true })) {
			subjectsRead.push(subject);
		}

		assert.equal(subjectsRead.length, 3);
		assert.equal(subjectsRead[0], '/test');
		assert.equal(subjectsRead[1], '/test/1');
		assert.equal(subjectsRead[2], '/test/2');
	});

	test(
		'reads only the subject itself, if it does not read recursively.',
		integrationTimeout,
		async (): Promise<void> => {
			const client = container.getClient();

			const firstEvent: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test/1',
				type: 'io.eventsourcingdb.test',
				data: {
					value: 23,
				},
			};

			const secondEvent: EventCandidate = {
				source: 'https://www.eventsourcingdb.io',
				subject: '/test/1/a',
				type: 'io.eventsourcingdb.test',
				data: {
					value: 42,
				},
			};

			await client.writeEvents([firstEvent, secondEvent]);

			const readSubjects = async (subject: string): Promise<string[]> => {
				const subjectsRead: string[] = [];
				for await (const subjectRead of client.readSubjects(subject, { recursive: false })) {
					subjectsRead.push(subjectRead);
				}
				return subjectsRead;
			};

			assert.deepEqual(await readSubjects('/test/1'), ['/test/1']);
			assert.deepEqual(await readSubjects('/test/1/'), ['/test/1']);
			assert.deepEqual(await readSubjects('/test'), ['/test']);
			assert.deepEqual(await readSubjects('/'), ['/']);
			assert.deepEqual(await readSubjects('/test/2'), []);
		},
	);
});
