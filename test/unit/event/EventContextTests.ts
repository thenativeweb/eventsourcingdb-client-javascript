import { assert } from 'assertthat';
import { EventContext } from '../../../lib/event/EventContext';
import { ValidationError } from '../../../lib/util/error/ValidationError';
import { events } from '../../shared/events/events';
import { testSource } from '../../shared/events/source';

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
				.is.throwing(
					error =>
						error.message === "Failed to parse source '42' to string." &&
						error instanceof ValidationError,
				);
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
					error =>
						error.message ===
							"Failed to validate subject: 'this/is/invalid' must be an absolute, slash-separated path." &&
						error instanceof ValidationError,
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
				.is.throwing(
					error =>
						error.message ===
							"Failed to validate type: 'a.this.is.invalid' must be a reverse domain name." &&
						error instanceof ValidationError,
				);
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
				.is.throwing(
					error =>
						error.message === "Failed to parse specVersion '1' to string." &&
						error instanceof ValidationError,
				);
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
				.is.throwing(
					error =>
						error.message === "Failed to parse id '[object Object]' to string." &&
						error instanceof ValidationError,
				);
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
				.is.throwing(
					error =>
						error.message === "Failed to parse time 'not a date' to Date." &&
						error instanceof ValidationError,
				);
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
				.is.throwing(
					error =>
						error.message === "Failed to parse dataContentType 'undefined' to string." &&
						error instanceof ValidationError,
				);
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
				.is.throwing(
					error =>
						error.message === "Failed to parse predecessorHash 'null' to string." &&
						error instanceof ValidationError,
				);
		});
	});
});
