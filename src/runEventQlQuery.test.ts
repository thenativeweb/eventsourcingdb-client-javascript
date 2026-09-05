import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Container } from './Container.js';
import type { EventCandidate } from './EventCandidate.js';
import { getImageVersionFromDockerfile } from './getImageVersionFromDockerfile.js';
import { isRecord } from './types/isRecord.js';

suite('runEventQlQuery', { timeout: 30_000 }, () => {
	let container: Container;

	beforeEach(async () => {
		const imageVersion = getImageVersionFromDockerfile();
		container = new Container().withImageTag(imageVersion);
		await container.start();
	});

	afterEach(async () => {
		await container.stop();
	});

	test('reads no rows if the query does not return any rows.', async (): Promise<void> => {
		const client = container.getClient();

		let didReadRows = false;
		for await (const _row of client.runEventQlQuery('FROM e IN events PROJECT INTO e')) {
			didReadRows = true;
		}

		assert.equal(didReadRows, false);
	});

	test('reads all rows the query returns.', async (): Promise<void> => {
		const client = container.getClient();

		const firstEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 23,
			},
		};

		const secondEvent: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: {
				value: 42,
			},
		};

		await client.writeEvents([firstEvent, secondEvent]);

		const rowsRead: unknown[] = [];
		for await (const row of client.runEventQlQuery('FROM e IN events PROJECT INTO e')) {
			rowsRead.push(row);
		}

		assert.equal(rowsRead.length, 2);

		const firstRow = rowsRead[0];
		assert.ok(isRecord(firstRow));
		assert.equal(firstRow.id, '0');
		assert.ok(isRecord(firstRow.data));
		assert.equal(firstRow.data.value, 23);

		const secondRow = rowsRead[1];
		assert.ok(isRecord(secondRow));
		assert.equal(secondRow.id, '1');
		assert.ok(isRecord(secondRow.data));
		assert.equal(secondRow.data.value, 42);
	});

	test('reads rows with primitive number values.', async (): Promise<void> => {
		const client = container.getClient();

		const event: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: { value: 42 },
		};

		await client.writeEvents([event]);

		const rowsRead: unknown[] = [];
		for await (const row of client.runEventQlQuery('FROM e IN events PROJECT INTO e.data.value')) {
			rowsRead.push(row);
		}

		assert.equal(rowsRead.length, 1);
		assert.equal(rowsRead[0], 42);
	});

	test('reads rows with primitive boolean values.', async (): Promise<void> => {
		const client = container.getClient();

		const event: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: { value: 42 },
		};

		await client.writeEvents([event]);

		const rowsRead: unknown[] = [];
		for await (const row of client.runEventQlQuery(
			'FROM e IN events PROJECT INTO e.data.value > 0',
		)) {
			rowsRead.push(row);
		}

		assert.equal(rowsRead.length, 1);
		assert.equal(rowsRead[0], true);
	});

	test('reads rows with primitive string values.', async (): Promise<void> => {
		const client = container.getClient();

		const event: EventCandidate = {
			source: 'https://www.eventsourcingdb.io',
			subject: '/test',
			type: 'io.eventsourcingdb.test',
			data: { name: 'hello' },
		};

		await client.writeEvents([event]);

		const rowsRead: unknown[] = [];
		for await (const row of client.runEventQlQuery('FROM e IN events PROJECT INTO e.data.name')) {
			rowsRead.push(row);
		}

		assert.equal(rowsRead.length, 1);
		assert.equal(rowsRead[0], 'hello');
	});
});
