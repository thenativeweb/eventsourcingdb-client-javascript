import { Client } from '../../lib';
import express from 'express';
import * as http from 'http';

const startLocalHttpServer = async function (
	attachHandlers: (app: express.Express) => void,
): Promise<{ client: Client; stopServer: () => Promise<void> }> {
	const app = express();

	attachHandlers(app);

	const server = await new Promise<http.Server>((resolve) => {
		const server = app.listen(0, () => {
			resolve(server);
		});
	});

	if (server === undefined) {
		throw new Error('Failed to start server.');
	}
	const address = server.address();

	if (typeof address === 'string' || address === null) {
		throw new Error('Failed to start server');
	}

	const client = new Client(`http://localhost:${address.port}`, { maxTries: 2 });
	const stopServer = async function () {
		await new Promise<void>((resolve) => {
			server.close(() => {
				resolve();
			});
		});
	};

	return { client, stopServer };
};

export { startLocalHttpServer };
