import { Client } from './Client.js';
import type { ObserveEventsOptions } from './ObserveEventsOptions.js';
import { isSubjectOnEventId, isSubjectPristine } from './Precondition.js';
import type { ReadEventsOptions } from './ReadEventsOptions.js';

const bla = async () => {
	const client = new Client(new URL('http://localhost:3000'), 'secret');

	await client.ping();
	console.log('Ping successful');

	const writtenEvents = await client.writeEvents(
		[
			{
				source: 'https://www.irgendwas.de',
				subject: '/bla/234',
				type: 'com.example.bla',
				data: {
					foo: 'bar',
					baz: 123,
					qux: true,
				},
			},
		],
		[isSubjectPristine('/bla/234')],
	);
	console.log('Written events:', writtenEvents);

	// const events = client.readEvents(
	// 	'/',
	// 	{
	// 		recursive: true,
	// 	},
	// 	new AbortController(),
	// );

	// for await (const event of events) {
	// 	console.log('Event read:', event);
	// }
};

bla();

export { Client, isSubjectPristine, isSubjectOnEventId };
export type { ReadEventsOptions, ObserveEventsOptions };
