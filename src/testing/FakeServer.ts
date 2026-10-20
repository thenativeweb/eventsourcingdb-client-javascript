import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { ApiVersion } from '../detectApiVersion.js';

interface FakeRequest {
	method: string;
	path: string;
	body: string;
	message: IncomingMessage;
}

type Respond = (request: FakeRequest, response: ServerResponse) => void;

const pingPath = '/api/v2/system/ping';

const neverRespond: Respond = (): void => {
	// Intentionally left blank, so that no answer ever arrives.
};

const serverHeader = { server: 'EventSourcingDB/test' };

// Answers the request with which a client finds out which API the server
// offers, as a server of that API does. It closes the connection, so that the
// requests after it open one of their own.
const answerProbe = (apiVersion: ApiVersion, response: ServerResponse): void => {
	if (apiVersion === 'v1') {
		response.writeHead(404, {
			...serverHeader,
			'content-type': 'text/plain; charset=utf-8',
			connection: 'close',
		});
		response.end('404 page not found\n');
		return;
	}

	response.writeHead(200, {
		...serverHeader,
		'content-type': 'application/json',
		connection: 'close',
	});
	response.end(
		JSON.stringify({
			type: 'event',
			data: {
				specversion: '1.0',
				id: '0',
				source: 'https://www.eventsourcingdb.io',
				subject: pingPath,
				type: 'io.eventsourcingdb.api.ping-received',
				time: '2026-10-18T12:00:00.000Z',
				datacontenttype: 'application/json',
				data: { message: "My God, it's full of stars." },
			},
		}),
	);
};

// A server for tests that answers like EventSourcingDB, as the test tells it
// to. Unless it has no API version, it answers the first ping of the v2 API
// itself, as a server of that API does, since that is how the first request
// of a client finds out which API the server offers. It hands every other
// request to the test, once its body has arrived.
class FakeServer {
	readonly #apiVersion: ApiVersion | undefined;
	readonly #server: Server;
	#hasAnsweredProbe = false;
	#requestReceived = Promise.withResolvers<FakeRequest>();
	readonly #connectionsClosed: Promise<unknown>[] = [];
	public readonly requests: FakeRequest[] = [];
	public probeCount = 0;
	public respond: Respond = neverRespond;

	public constructor(apiVersion?: ApiVersion) {
		this.#apiVersion = apiVersion;
		this.#server = createServer((message, response) => {
			this.#handle(message, response);
		});

		this.#server.on('connection', socket => {
			this.#connectionsClosed.push(once(socket, 'close'));
		});
	}

	#handle(message: IncomingMessage, response: ServerResponse): void {
		const path = message.url ?? '';

		if (path === pingPath && message.method === 'GET') {
			this.probeCount += 1;

			if (this.#apiVersion !== undefined && !this.#hasAnsweredProbe) {
				this.#hasAnsweredProbe = true;
				answerProbe(this.#apiVersion, response);
				return;
			}
		}

		const chunks: Buffer[] = [];
		message.on('data', (chunk: Buffer) => {
			chunks.push(chunk);
		});
		message.on('end', () => {
			const request: FakeRequest = {
				method: message.method ?? '',
				path,
				body: Buffer.concat(chunks).toString('utf-8'),
				message,
			};

			this.requests.push(request);
			this.#requestReceived.resolve(request);
			this.respond(request, response);
		});
	}

	public get url(): URL {
		const address = this.#server.address();
		if (address === null || typeof address === 'string') {
			throw new Error('Server must be listening.');
		}

		return new URL(`http://localhost:${address.port}/`);
	}

	// Resolves once the first request that the server hands to the test has
	// arrived, with that request.
	public get requestReceived(): Promise<FakeRequest> {
		return this.#requestReceived.promise;
	}

	// Lets the server answer the next ping of the v2 API itself again, as it
	// answers the first one, for a test that uses another client.
	public answerNextProbe(): void {
		this.#hasAnsweredProbe = false;
	}

	public async start(): Promise<void> {
		await new Promise<void>(resolve => {
			this.#server.listen(0, 'localhost', resolve);
		});
	}

	// Resolves once every connection that has been opened so far has closed.
	public async connectionsClosed(): Promise<void> {
		await Promise.all(this.#connectionsClosed);
	}

	public async stop(): Promise<void> {
		this.#server.closeAllConnections();
		await new Promise<void>(resolve => {
			this.#server.close(() => {
				resolve();
			});
		});
	}
}

// Writes the head of an answer that comes from EventSourcingDB.
const writeHead = (response: ServerResponse, status: number, contentType: string): void => {
	response.writeHead(status, {
		...serverHeader,
		'content-type': contentType,
	});
};

// Answers with a status other than 200 and a text, as EventSourcingDB does.
const answerWithText = (response: ServerResponse, status: number, text: string): void => {
	writeHead(response, status, 'text/plain; charset=utf-8');
	response.end(`${text}\n`);
};

const toLine = (value: unknown): string => `${JSON.stringify(value)}\n`;

export type { FakeRequest, Respond };
export { answerWithText, FakeServer, toLine, writeHead };
