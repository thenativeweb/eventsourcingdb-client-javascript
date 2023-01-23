import { prefixEventType } from './type';

const registeredEventType = prefixEventType('registered');
const loggedInEventType = prefixEventType('loggedIn');

const events = {
	registered: {
		janeDoe: {
			type: registeredEventType,
			data: { name: 'Jane Doe' },
		},
		johnDoe: {
			type: registeredEventType,
			data: { name: 'John Doe' },
		},
		apfelFred: {
			type: registeredEventType,
			data: { name: 'Apfel Fred' },
		},
	},
	loggedIn: {
		janeDoe: {
			type: loggedInEventType,
			data: { name: 'Jane Doe' },
		},
		johnDoe: {
			type: loggedInEventType,
			data: { name: 'John Doe' },
		},
		apfelFred: {
			type: loggedInEventType,
			data: { name: 'Apfel Fred' },
		},
	},
} as const;

export { events };
