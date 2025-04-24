import assert from 'node:assert/strict';
import { afterEach, beforeEach, suite, test } from 'node:test';
import type { EventCandidate } from './EventCandidate.js';
import { EventSourcingDbContainer } from './EventSourcingDbContainer.js';
import { getImageVersionFromDockerfile } from './getImageVersionFromDockerfile.js';

suite('runEventQlQuery', { timeout: 30_000 }, () => {
	let container: EventSourcingDbContainer;

	beforeEach(async () => {
		const imageVersion = getImageVersionFromDockerfile();
		container = new EventSourcingDbContainer().withImageTag(imageVersion);
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

		// biome-ignore lint/suspicious/noExplicitAny: Here, the cast is okay.
		const firstRow = rowsRead[0] as any;
		assert.equal(firstRow.id, '0');
		assert.equal(firstRow.data.value, 23);

		// biome-ignore lint/suspicious/noExplicitAny: Here, the cast is okay.
		const secondRow = rowsRead[1] as any;
		assert.equal(secondRow.id, '1');
		assert.equal(secondRow.data.value, 42);
	});
});
