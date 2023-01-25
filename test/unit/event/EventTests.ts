import { testSource } from '../../shared/events/source';
import { events } from '../../shared/events/events';
import { assert } from 'assertthat';
import { Event } from '../../../lib';

suite('Event', () => {
	suite('.parse()', () => {
		test('returns an Event for a valid object.', () => {
			const toParse = {
				source: testSource,
				subject: '/users/john-doe/loggedIn',
				type: events.loggedIn.johnDoe.type,
				specversion: '1.0.0',
				id: 'some-id',
				time: new Date().toISOString(),
				datacontenttype: 'some-data-content-type',
				predecessorhash: 'some-predecessor-hash',
				data: { someKey: 'some-data' },
			};

			assert
				.that(() => {
					Event.parse(toParse);
				})
				.is.not.throwing();
		});

		test('throws an error for missing data.', () => {
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
					Event.parse(toParse);
				})
				.is.throwing("Failed to parse data 'undefined' to object.");
		});

		test('throws an error for invalid data.', () => {
			const toParse = {
				source: testSource,
				subject: '/users/john-doe/loggedIn',
				type: events.loggedIn.johnDoe.type,
				specversion: '1.0.0',
				id: 'some-id',
				time: new Date().toISOString(),
				datacontenttype: 'some-data-content-type',
				predecessorhash: 'some-predecessor-hash',
				data: 42,
			};

			assert
				.that(() => {
					Event.parse(toParse);
				})
				.is.throwing("Failed to parse data '42' to object.");
		});
	});
});
