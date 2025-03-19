import type http from 'node:http';
import express from 'express';
import { Client } from '../../lib/index.js';

const startLocalHttpServer = async (
	attachHandlers: (app: express.Express) => void,
): Promise<{ client: Client; stopServer: () => Promise<void> }> => {
	const app = express();

	attachHandlers(app);

	const server = await new Promise<http.Server>(resolve => {
		const _server = app.listen(0, () => {
			resolve(_server);
		});
	});

	if (server === undefined) {
		throw new Error('Failed to start server.');
	}
	const address = server.address();

	if (typeof address === 'string' || address === null) {
		throw new Error('Failed to start server');
	}

	const client = new Client(`http://localhost:${address.port}`, {
		maxTries: 2,
		accessToken: 'irrelevant',
	});
	const stopServer = async () => {
		await new Promise<void>(resolve => {
			server.close(() => {
				resolve();
			});
		});
	};

	return { client, stopServer };
};

export { startLocalHttpServer };
