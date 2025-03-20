import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, suite, test } from 'node:test';
import { StatusCodes } from 'http-status-codes';
import type { Client } from '../../lib/index.js';
import { ServerError } from '../../lib/util/error/ServerError.js';
import type { Database } from '../shared/Database.js';
import { buildDatabase } from '../shared/buildDatabase.js';
import { startDatabase } from '../shared/startDatabase.js';
import { startLocalHttpServer } from '../shared/startLocalHttpServer.js';
import { stopDatabase } from '../shared/stopDatabase.js';

suite('ping', { timeout: 20_000 }, () => {
	let database: Database;

	before(() => {
		buildDatabase('test/shared/docker/eventsourcingdb');
	});

	beforeEach(async () => {
		database = await startDatabase();
	});

	afterEach(() => {
		stopDatabase(database);
	});

	test('throws an error if the server is not reachable.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert.rejects(
			async () => {
				await client.ping();
			},
			error => {
				assert.ok(error instanceof ServerError);
				assert.equal(error.message, 'Server error occurred: No response received.');
				return true;
			},
		);
	});

	test('does not throw an error if EventSourcingDB is reachable.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		// Should not throw.
		await client.ping();
	});

	suite('with a mock server', () => {
		let stopServer: () => Promise<void>;

		afterEach(async () => {
			await stopServer();
		});

		test('throws an error if the server responds with an unexpected status code.', async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.get('/api/ping', (_req, res) => {
					res.status(StatusCodes.BAD_GATEWAY);
					res.send('OK');
				});
			}));

			await assert.rejects(
				async () => {
					await client.ping();
				},
				error => {
					assert.ok(error instanceof ServerError);
					assert.equal(
						error.message,
						"Server error occurred: Request failed with status code '502'.",
					);
					return true;
				},
			);
		});

		test("throws an error if the server's response body is not 'OK'.", async (): Promise<void> => {
			let client: Client;
			({ client, stopServer } = await startLocalHttpServer(app => {
				app.get('/api/ping', (_req, res) => {
					res.status(StatusCodes.OK);
					res.send('Gude');
				});
			}));

			await assert.rejects(
				async () => {
					await client.ping();
				},
				error => {
					assert.ok(error instanceof ServerError);
					assert.equal(error.message, 'Server error occurred: Received unexpected response.');
					return true;
				},
			);
		});
	});
});
