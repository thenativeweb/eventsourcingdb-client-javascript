import { assert } from 'assertthat';
import { StatusCodes } from 'http-status-codes';
import type { Client } from '../../lib/index.js';
import { ServerError } from '../../lib/util/error/ServerError.js';
import type { Database } from '../shared/Database.js';
import { buildDatabase } from '../shared/buildDatabase.js';
import { startDatabase } from '../shared/startDatabase.js';
import { startLocalHttpServer } from '../shared/startLocalHttpServer.js';
import { stopDatabase } from '../shared/stopDatabase.js';

suite('Client.ping()', function () {
	this.timeout(20_000);
	let database: Database;

	suiteSetup(() => {
		buildDatabase('test/shared/docker/eventsourcingdb');
	});

	setup(async () => {
		database = await startDatabase();
	});

	teardown(() => {
		stopDatabase(database);
	});

	test('throws an error if the server is not reachable.', async (): Promise<void> => {
		const client = database.withInvalidUrl.client;

		await assert
			.that(async () => {
				await client.ping();
			})
			.is.throwingAsync(
				error =>
					error instanceof ServerError &&
					error.message === 'Server error occurred: No response received.',
			);
	});

	test('does not throw an error if EventSourcingDB is reachable.', async (): Promise<void> => {
		const client = database.withAuthorization.client;

		await assert
			.that(async () => {
				await client.ping();
			})
			.is.not.throwingAsync();
	});

	suite('with a mock server', () => {
		let stopServer: () => Promise<void>;

		teardown(async () => {
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

			await assert
				.that(async () => {
					await client.ping();
				})
				.is.throwingAsync(
					error =>
						error instanceof ServerError &&
						error.message ===
							'Server error occurred: Failed operation with 2 errors:\n' +
								"Error: Server error occurred: Request failed with status code '502'.\n" +
								"Error: Server error occurred: Request failed with status code '502'.",
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

			await assert
				.that(async () => {
					await client.ping();
				})
				.is.throwingAsync(
					error =>
						error instanceof ServerError &&
						error.message === 'Server error occurred: Received unexpected response.',
				);
		});
	});
});
