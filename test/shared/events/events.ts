import { prefixEventType } from './type.js';

const registeredEventType = prefixEventType('registered');
const loggedInEventType = prefixEventType('loggedIn');

interface PartialEvent {
	type: string;
	data: Record<string, unknown>;
	traceState?: string;
	traceParent?: string;
}

const events: Record<string, Record<string, PartialEvent>> = {
	registered: {
		janeDoe: {
			type: registeredEventType,
			data: { name: 'Jane Doe' },
			traceParent: '00-10000000000000000000000000000000-1000000000000000-00',
		},
		johnDoe: {
			type: registeredEventType,
			data: { name: 'John Doe' },
			traceParent: '00-20000000000000000000000000000000-2000000000000000-00',
		},
		apfelFred: {
			type: registeredEventType,
			data: { name: 'Apfel Fred' },
			traceParent: '00-30000000000000000000000000000000-3000000000000000-00',
		},
	},
	loggedIn: {
		janeDoe: {
			type: loggedInEventType,
			data: { name: 'Jane Doe' },
			traceParent: '00-40000000000000000000000000000000-4000000000000000-00',
		},
		johnDoe: {
			type: loggedInEventType,
			data: { name: 'John Doe' },
			traceParent: '00-50000000000000000000000000000000-5000000000000000-00',
		},
		apfelFred: {
			type: loggedInEventType,
			data: { name: 'Apfel Fred' },
			traceParent: '00-60000000000000000000000000000000-6000000000000000-00',
		},
	},
} as const;

export { events };
