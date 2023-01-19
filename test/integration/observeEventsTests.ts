import { Client } from '../../lib/Client';

suite('observeEvents', (): void => {
	test('Does the thing.', async (): Promise<void> => {
		const client = new Client('http://localhost:32769');

		const generator = client.observeEvents('/user/23', { recursive: true });

		for await (const item of generator) {
			console.error(JSON.stringify(item, null, 2));
		}
	});
});
