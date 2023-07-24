import { TracingContext } from '../../../lib';
import { prefixEventType } from './type';
import { TraceFlags } from '@opentelemetry/api';

const registeredEventType = prefixEventType('registered');
const loggedInEventType = prefixEventType('loggedIn');

const events = {
	registered: {
		janeDoe: {
			type: registeredEventType,
			data: { name: 'Jane Doe' },
			tracingContext: new TracingContext(
				'10000000000000000000000000000000',
				'1000000000000000',
				TraceFlags.NONE,
			),
		},
		johnDoe: {
			type: registeredEventType,
			data: { name: 'John Doe' },
			tracingContext: new TracingContext(
				'20000000000000000000000000000000',
				'2000000000000000',
				TraceFlags.NONE,
			),
		},
		apfelFred: {
			type: registeredEventType,
			data: { name: 'Apfel Fred' },
			tracingContext: new TracingContext(
				'30000000000000000000000000000000',
				'3000000000000000',
				TraceFlags.NONE,
			),
		},
	},
	loggedIn: {
		janeDoe: {
			type: loggedInEventType,
			data: { name: 'Jane Doe' },
			tracingContext: new TracingContext(
				'40000000000000000000000000000000',
				'4000000000000000',
				TraceFlags.NONE,
			),
		},
		johnDoe: {
			type: loggedInEventType,
			data: { name: 'John Doe' },
			tracingContext: new TracingContext(
				'50000000000000000000000000000000',
				'5000000000000000',
				TraceFlags.NONE,
			),
		},
		apfelFred: {
			type: loggedInEventType,
			data: { name: 'Apfel Fred' },
			tracingContext: new TracingContext(
				'60000000000000000000000000000000',
				'6000000000000000',
				TraceFlags.NONE,
			),
		},
	},
} as const;

export { events };
