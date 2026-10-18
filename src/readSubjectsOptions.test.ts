import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { Client } from './Client.js';
import { lines } from './testing/answers.js';
import { type FakeRequest, FakeServer, writeHead } from './testing/FakeServer.js';

const ndJson = 'application/x-ndjson';

const consume = async (iterator: AsyncGenerator<string, void, void>): Promise<string[]> => {
	const subjects: string[] = [];
	for await (const subject of iterator) {
		subjects.push(subject);
	}
	return subjects;
};

suite('readSubjects', { timeout: 30_000 }, () => {
	test('throws an error if the recursive option is missing.', (): void => {
		const client = new Client(new URL('http://localhost:3000/'), 'secret');

		for (const options of [undefined, {}, { recursive: 'yes' }]) {
			// A caller without types may leave out the option, which the types
			// do not allow.
			assert.throws((): unknown => Reflect.apply(client.readSubjects, client, ['/', options]), {
				name: 'Error',
				message: "Option 'recursive' must be set to true or false.",
			});
		}
	});

	suite('v1', () => {
		let server: FakeServer;
		let client: Client;

		beforeEach(async () => {
			// The v1 API always reads recursively.
			server = new FakeServer('v1');
			server.respond = (_request: FakeRequest, response: ServerResponse): void => {
				const { subject } = lines.v1;

				writeHead(response, 200, ndJson);
				response.end(
					`${subject('/test/1')}${subject('/test')}${subject('/test/1/a')}${subject('/test/2')}`,
				);
			};
			await server.start();

			client = new Client(server.url, 'secret');
		});

		afterEach(async () => {
			await server.stop();
		});

		test('reads the subjects below the subject as well, if it reads recursively.', async (): Promise<void> => {
			assert.deepEqual(await consume(client.readSubjects('/test', { recursive: true })), [
				'/test/1',
				'/test',
				'/test/1/a',
				'/test/2',
			]);

			const [request] = server.requests;
			assert.equal(request?.path, '/api/v1/read-subjects');
			assert.equal(request?.body, '{"baseSubject":"/test"}');
		});

		test('reads only the subject itself, if it does not read recursively.', async (): Promise<void> => {
			assert.deepEqual(await consume(client.readSubjects('/test', { recursive: false })), [
				'/test',
			]);
			assert.deepEqual(await consume(client.readSubjects('/test/1', { recursive: false })), [
				'/test/1',
			]);

			const [request] = server.requests;
			assert.equal(request?.body, '{"baseSubject":"/test"}');
		});

		test('reads no subject, if it does not read recursively and the subject does not exist.', async (): Promise<void> => {
			assert.deepEqual(await consume(client.readSubjects('/test/3', { recursive: false })), []);
		});

		test('reads the subject as the server keeps it, if it does not read recursively.', async (): Promise<void> => {
			// The server keeps a subject without a trailing slash, so it lists
			// '/test/' as '/test'.
			assert.deepEqual(await consume(client.readSubjects('/test/', { recursive: false })), [
				'/test',
			]);
			assert.deepEqual(await consume(client.readSubjects('/test/1/', { recursive: false })), [
				'/test/1',
			]);

			const [request] = server.requests;
			assert.equal(request?.body, '{"baseSubject":"/test/"}');
		});

		test('reads only the root itself, if it does not read recursively from the root.', async (): Promise<void> => {
			server.respond = (_request: FakeRequest, response: ServerResponse): void => {
				const { subject } = lines.v1;

				writeHead(response, 200, ndJson);
				response.end(`${subject('/')}${subject('/test')}${subject('/test/1')}`);
			};

			assert.deepEqual(await consume(client.readSubjects('/', { recursive: false })), ['/']);

			const [request] = server.requests;
			assert.equal(request?.body, '{"baseSubject":"/"}');
		});
	});

	suite('v2', () => {
		let server: FakeServer;
		let client: Client;

		beforeEach(async () => {
			server = new FakeServer('v2');
			server.respond = (_request: FakeRequest, response: ServerResponse): void => {
				const { subject, end } = lines.v2;

				writeHead(response, 200, ndJson);
				response.end(`${subject('/test')}${end}`);
			};
			await server.start();

			client = new Client(server.url, 'secret');
		});

		afterEach(async () => {
			await server.stop();
		});

		const defineTestFor = (recursive: boolean): void => {
			test(`sends the recursive option as ${recursive}.`, async (): Promise<void> => {
				assert.deepEqual(await consume(client.readSubjects('/test', { recursive })), ['/test']);

				const [request] = server.requests;
				assert.equal(request?.method, 'QUERY');
				assert.equal(request?.path, '/api/v2/data/read-subjects');
				assert.equal(request?.body, `{"subject":"/test","options":{"recursive":${recursive}}}`);
			});
		};

		for (const recursive of [true, false]) {
			defineTestFor(recursive);
		}
	});
});
