import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { Event } from '../../../src/index.js';
import { events } from '../../shared/events/events.js';
import { testSource } from '../../shared/events/source.js';

suite('Event', () => {
	suite('parse', () => {
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

			// Should not throw.
			Event.parse(toParse);
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

			assert.throws(
				() => {
					Event.parse(toParse);
				},
				{
					message: "Failed to parse data 'undefined' to object.",
				},
			);
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

			assert.throws(
				() => {
					Event.parse(toParse);
				},
				{
					message: "Failed to parse data '42' to object.",
				},
			);
		});
	});
});
