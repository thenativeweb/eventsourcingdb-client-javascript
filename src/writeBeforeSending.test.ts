import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { ConnectionStalledError } from './ConnectionStalledError.js';
import type { ApiVersion } from './detectApiVersion.js';
import { OutcomeUnknownError } from './OutcomeUnknownError.js';
import type { Transport, TransportOptions } from './Transport.js';
import { apiVersions } from './testing/answers.js';
import { V1Transport } from './v1/V1Transport.js';
import { V2Transport } from './v2/V2Transport.js';

const keepApiVersion = (): void => {
	// Intentionally left blank, since there is no client that could forget.
};

// The transports are used directly, since the client would first have to find
// out which API the server offers, which needs a connection that works.
const createTransport = (apiVersion: ApiVersion, options: TransportOptions): Transport =>
	apiVersion === 'v1'
		? new V1Transport(options)
		: new V2Transport({ ...options, forgetApiVersion: keepApiVersion });

interface Write {
	name: string;
	run: (transport: Transport, signal?: AbortSignal) => Promise<unknown>;
}

const writeEvents: Write = {
	name: 'writeEvents',
	run: async (transport: Transport, signal?: AbortSignal): Promise<unknown> =>
		await transport.writeEvents(
			[
				{
					source: 'https://www.eventsourcingdb.io',
					subject: '/test',
					type: 'io.eventsourcingdb.test',
					data: { value: 23 },
				},
			],
			[],
			signal,
		),
};

const registerEventSchema: Write = {
	name: 'registerEventSchema',
	run: async (transport: Transport, signal?: AbortSignal): Promise<unknown> =>
		await transport.registerEventSchema('io.eventsourcingdb.test', { type: 'object' }, signal),
};

const writes: Write[] = [writeEvents, registerEventSchema];

const isAbortError = (error: unknown): boolean =>
	error instanceof DOMException && error.name === 'AbortError';

// A write that fails before its request went out certainly was not stored,
// however it fails, so it fails with the error itself. The server accepts the
// connection, but never answers the TLS handshake, so the request never gets
// beyond establishing the connection.
suite('a write that fails before its request went out', { timeout: 30_000 }, () => {
	let server: net.Server;
	let sockets: net.Socket[];
	let url: URL;

	beforeEach(async () => {
		sockets = [];
		server = net.createServer(socket => {
			sockets.push(socket);
		});
		await new Promise<void>(resolve => {
			server.listen(0, '127.0.0.1', resolve);
		});

		const address = server.address();
		if (address === null || typeof address === 'string') {
			throw new Error('Failed to get server address.');
		}

		url = new URL(`https://127.0.0.1:${address.port}/`);
	});

	afterEach(async () => {
		for (const socket of sockets) {
			socket.destroy();
		}
		await new Promise<void>(resolve => {
			server.close(() => {
				resolve();
			});
		});
	});

	const defineTestsFor = (apiVersion: ApiVersion, { name, run }: Write): void => {
		suite(`${name} (${apiVersion})`, () => {
			test('throws the abort error itself if the caller aborts while it connects.', async (): Promise<void> => {
				const transport = createTransport(apiVersion, {
					url,
					apiToken: 'secret',
					stallTimeout: 30_000,
				});
				const controller = new AbortController();

				const rejected = assert.rejects(
					run(transport, controller.signal),
					(error: unknown): boolean =>
						!(error instanceof OutcomeUnknownError) && isAbortError(error),
				);

				await once(server, 'connection');
				controller.abort();
				await rejected;
			});

			test('throws the connection stalled error itself if it stalls while it connects.', async (): Promise<void> => {
				const transport = createTransport(apiVersion, {
					url,
					apiToken: 'secret',
					stallTimeout: 250,
				});

				await assert.rejects(
					run(transport),
					(error: unknown): boolean =>
						error instanceof ConnectionStalledError &&
						error.cause instanceof Error &&
						'code' in error.cause &&
						error.cause.code === 'UND_ERR_HEADERS_TIMEOUT',
				);
			});
		});
	};

	for (const apiVersion of apiVersions) {
		for (const write of writes) {
			defineTestsFor(apiVersion, write);
		}
	}

	// The fetch built into Node.js gives up connecting after 10 seconds, so
	// this runs every write at once.
	test('throws the error of fetch itself if fetch gives up connecting.', {
		timeout: 20_000,
	}, async (): Promise<void> => {
		await Promise.all(
			apiVersions.flatMap(apiVersion =>
				writes.map(async ({ run }): Promise<void> => {
					const transport = createTransport(apiVersion, {
						url,
						apiToken: 'secret',
						stallTimeout: 30_000,
					});

					await assert.rejects(
						run(transport),
						(error: unknown): boolean =>
							error instanceof TypeError &&
							!(error instanceof ConnectionStalledError) &&
							error.cause instanceof Error &&
							'code' in error.cause &&
							error.cause.code === 'UND_ERR_CONNECT_TIMEOUT',
					);
				}),
			),
		);
	});

	test('throws an unknown outcome if it cannot tell whether the request went out.', async (): Promise<void> => {
		// A fetch that is not the one built into Node.js does not tell when the
		// headers of a request went out.
		const originalFetch = globalThis.fetch;
		const failure = new TypeError('fetch failed');
		globalThis.fetch = async (): Promise<Response> => {
			await Promise.resolve();
			throw failure;
		};

		try {
			await assert.rejects(
				writeEvents.run(createTransport('v2', { url, apiToken: 'secret', stallTimeout: 30_000 })),
				(error: unknown): boolean =>
					error instanceof OutcomeUnknownError && error.cause === failure,
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
