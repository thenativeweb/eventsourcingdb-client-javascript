# eventsourcingdb

The official JavaScript client SDK for [EventSourcingDB](https://www.eventsourcingdb.io) – a purpose-built database for event sourcing.

EventSourcingDB enables you to build and operate event-driven applications with native support for writing, reading, and observing events. This client SDK provides convenient access to its capabilities in JavaScript and TypeScript.

For more information on EventSourcingDB, see its [official documentation](https://docs.eventsourcingdb.io/).

This client SDK includes support for [Testcontainers](https://testcontainers.com/) to spin up EventSourcingDB instances in integration tests. For details, see [Using Testcontainers](#using-testcontainers).

## Getting Started

Install the client SDK:

```shell
npm install eventsourcingdb
```

Import the `Client` class and create an instance by providing the URL of your EventSourcingDB instance and the API token to use:

```typescript
import { Client } from 'eventsourcingdb';

const url = new URL('http://localhost:3000');
const apiToken = 'secret';

const client = new Client(url, apiToken);
```

Then call the `ping` function to check whether the instance is reachable. If it is not, the function will throw an error:

```typescript
await client.ping();
```

*Note that `ping` does not require authentication, so the call may succeed even if the API token is invalid.*

If you want to verify the API token, call `verifyApiToken`. If the token is invalid, the function will throw an error:

```typescript
await client.verifyApiToken();
```

### Writing Events

Call the `writeEvents` function and hand over an array with one or more events. You do not have to provide all event fields – some are automatically added by the server.

Specify `source`, `subject`, `type`, and `data` according to the [CloudEvents](https://docs.eventsourcingdb.io/fundamentals/cloud-events/) format.

The function returns the written events, including the fields added by the server:

```typescript
const writtenEvents = await client.writeEvents([
  {
    source: 'https://library.eventsourcingdb.io',
    subject: '/books/42',
    type: 'io.eventsourcingdb.library.book-acquired',
    data: {
      title: '2001 – A Space Odyssey',
      author: 'Arthur C. Clarke',
      isbn: '978-0756906788'
    }
  }
]);
```

#### Using the `isSubjectPristine` precondition

If you only want to write events in case a subject (such as `/books/42`) does not yet have any events, import the `isSubjectPristine` function and pass it as the second argument as an array of preconditions:

```typescript
import { isSubjectPristine } from 'eventsourcingdb';

const writtenEvents = await client.writeEvents([
  // events
], [
  isSubjectPristine('/books/42')
]);
```

#### Using the `isSubjectOnEventId` precondition

If you only want to write events in case the last event of a subject (such as `/books/42`) has a specific ID (e.g., `0`), import the `isSubjectOnEventId` function and pass it as an array of preconditions in the second argument:

```typescript
import { isSubjectOnEventId } from 'eventsourcingdb';

const writtenEvents = await client.writeEvents([
  // events
], [
  isSubjectOnEventId('/books/42', '0')
]);
```

*Note that according to the CloudEvents standard, event IDs must be of type string.*

### Reading Events

To read all events of a subject, call the `readEvents` function with the subject as the first argument and an options object as the second argument. Set the `recursive` option to `false`. This ensures that only events of the given subject are returned, not events of nested subjects.

The function returns an asynchronous iterator, which you can use e.g. inside a `for await` loop:

```typescript
for await (const event of client.readEvents('/books/42', {
  recursive: false
})) {
  // ...
}
```

#### Reading From Subjects Recursively

If you want to read not only all the events of a subject, but also the events of all nested subjects, set the `recursive` option to `true`:

```typescript
for await (const event of client.readEvents('/books/42', {
  recursive: true
})) {
  // ...
}
```

This also allows you to read *all* events ever written. To do so, provide `/` as the subject and set `recursive` to `true`, since all subjects are nested under the root subject.

#### Reading in Anti-Chronological Order

By default, events are read in chronological order. To read in anti-chronological order, provide the `order` option and set it to `antichronological`:

```typescript
for await (const event of client.readEvents('/books/42', {
  recursive: false,
  order: 'antichronological'
})) {
  // ...
}
```

*Note that you can also specify `chronological` to explicitly enforce the default order.*

#### Specifying Bounds

Sometimes you do not want to read all events, but only a range of events. For that, you can specify the `lowerBound` and `upperBound` options – either one of them or even both at the same time.

Specify the ID and whether to include or exclude it, for both the lower and upper bound:

```typescript
for await (const event of client.readEvents('/books/42', {
  recursive: false,
  lowerBound: { id: '100', type: 'inclusive' },
  upperBound: { id: '200', type: 'exclusive' }
})) {
  // ...
}
```

#### Starting From the Latest Event of a Given Type

To read starting from the latest event of a given type, provide the `fromLatestEvent` option and specify the subject, the type, and how to proceed if no such event exists.

Possible options are `read-nothing`, which skips reading entirely, or `read-everything`, which effectively behaves as if `fromLatestEvent` was not specified:

```typescript
for await (const event of client.readEvents('/books/42', {
  recursive: false,
  fromLatestEvent: {
    subject: '/books/42',
    type: 'io.eventsourcingdb.library.book-borrowed',
    ifEventIsMissing: 'read-everything'
  }
})) {
  // ...
}
```

*Note that `fromLatestEvent` and `lowerBound` can not be provided at the same time.*

#### Aborting Reading

If you need to abort reading use `break` or `return` within the `for await` loop. However, this only works if there is currently an iteration going on.

To abort reading independently of that, hand over an abort signal as third argument when calling `readEvents`, and abort the appropriate `AbortController`:

```typescript
const controller = new AbortController();

for await (const event of client.readEvents('/books/42', {
  recursive: false
}, controller.signal)) {
  // ...
}

// Somewhere else, abort the controller, which will cause
// reading to end.
controller.abort();
```

### Running EventQL Queries

To run an EventQL query, call the `runEventQlQuery` function and provide the query as argument. The function returns an asynchronous iterator, which you can use e.g. inside a `for await` loop:

```typescript
for await (const row of client.runEventQlQuery(`
  FROM e IN events
  PROJECT INTO e
`)) {
  // ...
}
```

*Note that each row returned by the iterator matches the projection specified in your query.*

#### Aborting a Query

If you need to abort a query use `break` or `return` within the `for await` loop. However, this only works if there is currently an iteration going on.

To abort the query independently of that, hand over an abort signal as second argument when calling `runEventQlQuery`, and abort the appropriate AbortController:

```typescript
const controller = new AbortController();

for await (const row of client.runEventQlQuery(`
  FROM e IN events
  PROJECT INTO e
`, controller.signal)) {
  // ...
}

// Somewhere else, abort the controller, which will cause
// the query to end.
controller.abort();
```

### Observing Events

To observe all events of a subject, call the `observeEvents` function with the subject as the first argument and an options object as the second argument. Set the `recursive` option to `false`. This ensures that only events of the given subject are returned, not events of nested subjects.

The function returns an asynchronous iterator, which you can use e.g. inside a `for await` loop:

```typescript
for await (const event of client.observeEvents('/books/42', {
  recursive: false
})) {
  // ...
}
```

#### Observing From Subjects Recursively

If you want to observe not only all the events of a subject, but also the events of all nested subjects, set the `recursive` option to `true`:

```typescript
for await (const event of client.observeEvents('/books/42', {
  recursive: true
})) {
  // ...
}
```

This also allows you to observe *all* events ever written. To do so, provide `/` as the subject and set `recursive` to `true`, since all subjects are nested under the root subject.

#### Specifying Bounds

Sometimes you do not want to observe all events, but only a range of events. For that, you can specify the `lowerBound` option.

Specify the ID and whether to include or exclude it:

```typescript
for await (const event of client.observeEvents('/books/42', {
  recursive: false,
  lowerBound: { id: '100', type: 'inclusive' }
})) {
  // ...
}
```

#### Starting From the Latest Event of a Given Type

To observe starting from the latest event of a given type, provide the `fromLatestEvent` option and specify the subject, the type, and how to proceed if no such event exists.

Possible options are `wait-for-event`, which waits for an event of the given type to happen, or `read-everything`, which effectively behaves as if `fromLatestEvent` was not specified:

```typescript
for await (const event of client.observeEvents('/books/42', {
  recursive: false,
  fromLatestEvent: {
    subject: '/books/42',
    type: 'io.eventsourcingdb.library.book-borrowed',
    ifEventIsMissing: 'read-everything'
  }
})) {
  // ...
}
```

*Note that `fromLatestEvent` and `lowerBound` can not be provided at the same time.*

#### Aborting Observing

If you need to abort observing use `break` or `return` within the `for await` loop. However, this only works if there is currently an iteration going on.

To abort observing independently of that, hand over an abort signal as third argument when calling `observeEvents`, and abort the appropriate `AbortController`:

```typescript
const controller = new AbortController();

for await (const event of client.observeEvents('/books/42', {
  recursive: false
}, controller.signal)) {
  // ...
}

// Somewhere else, abort the controller, which will cause
// observing to end.
controller.abort();
```

### Registering an Event Schema

To register an event schema, call the `registerEventSchema` function and hand over an event type and the desired schema:

```typescript
await client.registerEventSchema('io.eventsourcingdb.library.book-acquired', {
  type: 'object',
  properties: {
    title: { type: 'string' },
    author: { type: 'string' },
    isbn: { type: 'string' }
  },
  required: [
    'title',
    'author',
    'isbn'
  ],
  additionalProperties: false
});
```

### Listing Subjects

To list all subjects, call the `readSubjects` function with `/` as the base subject. The function returns an asynchronous iterator, which you can use e.g. inside a `for await` loop:

```typescript
for await (const subject of client.readSubjects('/')) {
  // ...
}
```

If you only want to list subjects within a specific branch, provide the desired base subject instead:

```typescript
for await (const subject of client.readSubjects('/books')) {
  // ...
}
```

#### Aborting Listing

If you need to abort listing use `break` or `return` within the `for await` loop. However, this only works if there is currently an iteration going on.

To abort listing independently of that, hand over an abort signal as second argument when calling `readSubjects`, and abort the appropriate `AbortController`:

```typescript
const controller = new AbortController();

for await (const subject of client.readSubjects(
  '/', controller.signal)
) {
  // ...
}

// Somewhere else, abort the controller, which will cause
// reading to end.
controller.abort();
```

### Listing Event Types

To list all event types, call the `readEventTypes` function. The function returns an asynchronous iterator, which you can use e.g. inside a `for await` loop:

```typescript
for await (const eventType of client.readEventTypes()) {
  // ...
}
```

#### Aborting Listing

If you need to abort listing use `break` or `return` within the `for await` loop. However, this only works if there is currently an iteration going on.

To abort listing independently of that, hand over an abort signal as argument when calling `readEventTypes`, and abort the appropriate `AbortController`:

```typescript
const controller = new AbortController();

for await (const eventType of client.readEventTypes()) {
  // ...
}

// Somewhere else, abort the controller, which will cause
// reading to end.
controller.abort();
```

### Using Testcontainers

Import the `EventSourcingDbContainer` class, create an instance, call the `start` function to run a test container, get a client, run your test code, and finally call the `stop` function to stop the test container:

```typescript
import { EventSourcingDbContainer } from 'eventsourcingdb';

const container = new EventSourcingDbContainer();
await container.start();

const client = container.getClient();

// ...

await container.stop();
```

To check if the test container is running, call the `isRunning` function:

```typescript
const isRunning = container.isRunning();
```

#### Configuring the Container Instance

By default, `EventSourcingDbContainer` uses the `latest` tag of the official EventSourcingDB Docker image. To change that, call the `withImageTag` function:

```typescript
const container = new EventSourcingDbContainer()
  .withImageTag('1.0.0');
```

Similarly, you can configure the port to use and the API token. Call the `withPort` or the `withApiToken` function respectively:

```typescript
const container = new EventSourcingDbContainer()
  .withPort(4000)
  .withApiToken('secret');
```

#### Configuring the Client Manually

In case you need to set up the client yourself, use the following functions to get details on the container:

- `getHost()` returns the host name
- `getMappedPort()` returns the port
- `getBaseUrl()` returns the full URL of the container
- `getApiToken()` returns the API token
