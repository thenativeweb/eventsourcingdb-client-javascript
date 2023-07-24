import {Database} from "../shared/Database";
import {buildDatabase} from "../shared/buildDatabase";
import {startDatabase} from "../shared/startDatabase";
import {stopDatabase} from "../shared/stopDatabase";
import {testSource} from "../shared/events/source";
import {EventCandidate} from "../../lib";
import {EventType} from "../../lib/handlers/readEventTypes/EventType";
import {assert} from "assertthat";

suite('Client.readEventTypes()', function () {
    this.timeout(20_000);
    let database: Database;

    suiteSetup(async () => {
        buildDatabase('test/shared/docker/eventsourcingdb');
    });

    setup(async () => {
        database = await startDatabase();
    });

    teardown(async () => {
        await stopDatabase(database);
    });

    test('Reads all event types of existing events, as well as all event types with registered schemas.', async () => {
        const client = database.withAuthorization.client;

        await client.writeEvents([
            new EventCandidate(testSource, '/account', 'com.foo.bar', {}),
            new EventCandidate(testSource, '/account/user', 'com.bar.baz', {}),
            new EventCandidate(testSource, '/account/user', 'com.baz.leml', {}),
            new EventCandidate(testSource, '/', 'com.quux.knax', {}),
        ]);

        await client.registerEventSchema('org.ban.ban', { type: 'object'});
        await client.registerEventSchema('org.bing.chilling', { type: 'object'});

        const expectedEventTypes: EventType[] = [
            {
                type: 'com.foo.bar',
                isPhantom: false,
            },
            {
                type: 'com.bar.baz',
                isPhantom: false,
            },
            {
                type: 'com.baz.leml',
                isPhantom: false,
            },
            {
                type: 'com.quux.knax',
                isPhantom: false,
            },
            {
                type: 'org.ban.ban',
                isPhantom: true,
                schema: `{"type":"object"}`
            },
            {
                type: 'org.bing.chilling',
                isPhantom: true,
                schema: `{"type":"object"}`
            },
        ];

        const observedEventTypes: EventType[] = [];
        for await (const observedEventType of client.readEventTypes(new AbortController())) {
            observedEventTypes.push(observedEventType);
        }

        assert.that(observedEventTypes).is.equalTo(expectedEventTypes);
    });
});