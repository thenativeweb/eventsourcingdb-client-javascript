import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { Client } from '../src/Client.js';
import { EventSourcingDb } from './docker/EventSourcingDb.js';

suite('ping', { timeout: 20_000 }, () => {
	let eventSourcingDb: EventSourcingDb;

	before(() => {
		EventSourcingDb.build();
	});

	beforeEach(async () => {
		eventSourcingDb = await EventSourcingDb.run();
	});

	afterEach(() => {
		eventSourcingDb.kill();
	});

	test('does not throw an error if the server is reachable.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		// Should not throw.
		await client.ping();
	});

	test('throws an error if the server is not reachable.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://non-existent-host:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		await assert.rejects(
			async () => {
				await client.ping();
			},
			error => {
				assert.ok(error instanceof Error);
				assert.equal(error.message, 'fetch failed');
				return true;
			},
		);
	});
});
