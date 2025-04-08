import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { Client } from '../src/Client.js';
import type { Event } from '../src/Event.js';
import type { EventCandidate } from '../src/EventCandidate.js';
import { EventSourcingDb } from './docker/EventSourcingDb.js';

suite('observeEvents', { skip: true, timeout: 5_000 }, () => {
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

	test('reads no events if the database is empty.', async (): Promise<void> => {
		const client = new Client(
			new URL(`http://localhost:${eventSourcingDb.port}/`),
			eventSourcingDb.apiToken,
		);

		let didObserveEvents = false;
		for await (const _event of client.observeEvents('/', {
			recursive: true,
		})) {
			didObserveEvents = true;
		}

		assert.equal(didObserveEvents, false);
	});
});
