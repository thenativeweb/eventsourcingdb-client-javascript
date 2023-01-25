import { testSource } from '../../shared/events/source';
import { events } from '../../shared/events/events';
import { assert } from 'assertthat';
import { EventContext } from '../../../lib/event/EventContext';

suite('EventContext', () => {
	suite('.parse()', () => {
		test('returns an EventContext for a valid object.', () => {
			const toParse = {
				source: testSource,
				subject: '/users/john-doe/loggedIn',
				type: events.loggedIn.johnDoe.type,
				specversion: '1.0.0',
				id: 'some-id',
				time: new Date().toISOString(),
				datacontenttype: 'some-data-content-type',
				predecessorhash: 'some-predecessor-hash',
			};

			assert
				.that(() => {
					EventContext.parse(toParse);
				})
				.is.not.throwing();
		});

		test('throws an error for invalid source.', () => {
			const toParse = {
				source: 42,
				subject: '/users/john-doe/loggedIn',
				type: events.loggedIn.johnDoe.type,
				specversion: '1.0.0',
				id: 'some-id',
				time: new Date().toISOString(),
				datacontenttype: 'some-data-content-type',
				predecessorhash: 'some-predecessor-hash',
			};

			assert
				.that(() => {
					EventContext.parse(toParse);
				})
				.is.throwing("Failed to parse source '42' to string.");
		});

		test('throws an error for invalid subject.', () => {
			const toParse = {
				source: testSource,
				subject: 'this/is/invalid',
				type: events.loggedIn.johnDoe.type,
				specversion: '1.0.0',
				id: 'some-id',
				time: new Date().toISOString(),
				datacontenttype: 'some-data-content-type',
				predecessorhash: 'some-predecessor-hash',
			};

			assert
				.that(() => {
					EventContext.parse(toParse);
				})
				.is.throwing(
					"Failed to validate subject: 'this/is/invalid' must be an absolute, slash-separated path.",
				);
		});

		test('throws an error for invalid type.', () => {
			const toParse = {
				source: testSource,
				subject: '/users/john-doe/loggedIn',
				type: 'a.this.is.invalid',
				specversion: '1.0.0',
				id: 'some-id',
				time: new Date().toISOString(),
				datacontenttype: 'some-data-content-type',
				predecessorhash: 'some-predecessor-hash',
			};

			assert
				.that(() => {
					EventContext.parse(toParse);
				})
				.is.throwing("Failed to validate type: 'a.this.is.invalid' must be reverse domain name.");
		});

		test('throws an error for invalid specversion.', () => {
			const toParse = {
				source: testSource,
				subject: '/users/john-doe/loggedIn',
				type: events.loggedIn.johnDoe.type,
				specversion: 1.0,
				id: 'some-id',
				time: new Date().toISOString(),
				datacontenttype: 'some-data-content-type',
				predecessorhash: 'some-predecessor-hash',
			};

			assert
				.that(() => {
					EventContext.parse(toParse);
				})
				.is.throwing("Failed to parse specVersion '1' to string.");
		});

		test('throws an error for invalid id.', () => {
			const toParse = {
				source: testSource,
				subject: '/users/john-doe/loggedIn',
				type: events.loggedIn.johnDoe.type,
				specversion: '1.0.0',
				id: { id: 'id' },
				time: new Date().toISOString(),
				datacontenttype: 'some-data-content-type',
				predecessorhash: 'some-predecessor-hash',
			};

			assert
				.that(() => {
					EventContext.parse(toParse);
				})
				.is.throwing("Failed to parse id '[object Object]' to string.");
		});

		test('throws an error for invalid time.', () => {
			const toParse = {
				source: testSource,
				subject: '/users/john-doe/loggedIn',
				type: events.loggedIn.johnDoe.type,
				specversion: '1.0.0',
				id: 'some-id',
				time: 'not a date',
				datacontenttype: 'some-data-content-type',
				predecessorhash: 'some-predecessor-hash',
			};

			assert
				.that(() => {
					EventContext.parse(toParse);
				})
				.is.throwing("Failed to parse time 'not a date' to Date.");
		});

		test('throws an error for invalid dataContentType.', () => {
			const toParse = {
				source: testSource,
				subject: '/users/john-doe/loggedIn',
				type: events.loggedIn.johnDoe.type,
				specversion: '1.0.0',
				id: 'some-id',
				time: new Date().toISOString(),
				datacontenttype: undefined,
				predecessorhash: 'some-predecessor-hash',
			};

			assert
				.that(() => {
					EventContext.parse(toParse);
				})
				.is.throwing("Failed to parse dataContentType 'undefined' to string.");
		});

		test('throws an error for invalid dataContentType.', () => {
			const toParse = {
				source: testSource,
				subject: '/users/john-doe/loggedIn',
				type: events.loggedIn.johnDoe.type,
				specversion: '1.0.0',
				id: 'some-id',
				time: new Date().toISOString(),
				datacontenttype: 'some-data-content-type',
				predecessorhash: null,
			};

			assert
				.that(() => {
					EventContext.parse(toParse);
				})
				.is.throwing("Failed to parse predecessorHash 'null' to string.");
		});
	});
});
