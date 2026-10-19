# eventsourcingdb

The official JavaScript client SDK for [EventSourcingDB](https://www.eventsourcingdb.io) – a purpose-built database for event sourcing.

EventSourcingDB enables you to build and operate event-driven applications with native support for writing, reading, and observing events. This client SDK provides convenient access to its capabilities in JavaScript and TypeScript.

For more information on EventSourcingDB, see its [official documentation](https://docs.eventsourcingdb.io/).

This client SDK includes support for [Testcontainers](https://testcontainers.com/) to spin up EventSourcingDB instances in integration tests. For details, see [Using Testcontainers](#using-testcontainers).

If you are upgrading from version 1 of this client SDK, see [Upgrading From Version 1](#upgrading-from-version-1).

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

### Talking to Servers With and Without the v2 API

EventSourcingDB offers its v2 API since version 1.3, while older versions offer only the v1 API. This client SDK works with both. Creating a client does not send a request. Instead, the first request of a client asks the server whether it offers the v2 API, by sending a `GET` request to `/api/v2/system/ping`, and the client uses the v2 API if it does, and the v1 API otherwise. The client keeps the answer, so every later request goes straight to the API it found. If the server answers a path of the v2 API with 404 or 405, for example after it was rolled back to a version without it, the client asks again on the next request. If the client cannot find out, for example because the server is not reachable, the first request fails with that error, and the next request asks again.

Through the v2 API, all functions that read use the HTTP method `QUERY` ([RFC 10008](https://www.rfc-editor.org/rfc/rfc10008)), which, unlike `GET`, carries a request body. If there is a proxy or a load balancer in front of EventSourcingDB, it has to let `QUERY` requests through. There is no fallback to `POST`.

### Configuring the Stall Timeout

Every request fails once nothing arrives from the server for 30 seconds, for example because the server does not respond, or because a proxy keeps the connection open but no longer passes anything through. The time counts from sending the request until it ends, including connecting and waiting for the response. Everything that arrives starts it anew, so a long stream that keeps receiving events, rows, or heartbeats is never cut off, and the time you spend handling an item of a stream does not count.

A request that stalls throws a `ConnectionStalledError`. It extends `TypeError`, since `fetch` throws a `TypeError` when its own timeouts run out, and its `cause` has the `code` that the cause of that `TypeError` has, `UND_ERR_HEADERS_TIMEOUT` while waiting for the response headers and `UND_ERR_BODY_TIMEOUT` afterwards:

```typescript
import { ConnectionStalledError } from 'eventsourcingdb';

try {
  await client.ping();
} catch (error) {
  if (error instanceof ConnectionStalledError) {
    // ...
  }
}
```

To change the 30 seconds, hand over the `stallTimeout` option in milliseconds as third argument when creating the client:

```typescript
const client = new Client(url, apiToken, {
  stallTimeout: 10_000
});
```

*Note that the `fetch` built into Node.js has timeouts of its own, which keep applying: 10 seconds for connecting, 300 seconds for waiting for the response headers, and 300 seconds without data in the response body. If one of them runs out first, the request throws the `TypeError` of `fetch`, with the message `fetch failed` or `terminated`. A `stallTimeout` above these values therefore cannot extend them.*

*Note that a write that stalls, a call of `writeEvents` or `registerEventSchema`, throws an `OutcomeUnknownError` whose `cause` is the `ConnectionStalledError`, since the write may have been stored nonetheless, see [Knowing Whether a Write Was Stored](#knowing-whether-a-write-was-stored).*

### Aborting a Request

Every function that sends a request takes an abort signal as last argument. To abort a call of `ping`, `verifyApiToken`, or `readEventType`, hand over an abort signal, and abort the appropriate `AbortController`. The call then throws the reason of the abort, which is an `AbortError` unless you provide a reason of your own:

```typescript
const controller = new AbortController();

try {
  await client.readEventType('io.eventsourcingdb.library.book-acquired', controller.signal);
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    // ...
  }
}

// Somewhere else, abort the controller, which will cause
// readEventType to throw.
controller.abort();
```

Aborting `writeEvents` or `registerEventSchema` once the write has been sent does not undo it, so the write may have been stored nonetheless. The call then throws an `OutcomeUnknownError` whose `cause` is the reason of the abort, see [Knowing Whether a Write Was Stored](#knowing-whether-a-write-was-stored). If the write has not been sent yet, because the signal was aborted before or while the client SDK still establishes the connection, the call throws the reason of the abort itself.

*Note that aborting a function that returns an asynchronous iterator, such as `readEvents`, does not throw, but ends the iteration, see [Aborting Reading](#aborting-reading).*

### Handling Errors

Every error that the server reports throws a `DbApiError`, whether the server describes it in its answer, answers with an HTTP status other than `200`, or reports it while a stream is running. A `DbApiError` has the following fields:

- `code` is the URL that names the error, exactly as the server sends it, for example `https://docs.eventsourcingdb.io/errors/precondition-violated`. It doubles as a link to the documentation of the error. It is `undefined` for an error without a code.
- `description` is the text that describes the error.
- `details` is an object with details on the error, such as the index of the precondition that does not hold. It is empty for an error without details.
- `status` is the HTTP status of the answer, which is `200` for an error that the server describes in its answer.
- `retryAfter` is the number of seconds after which the server accepts requests again, which only an answer with the HTTP status `429` may name. The client SDK never repeats a request on its own.

To tell errors apart, compare the `code` with the constants of `ErrorCode`, which has a constant for each code that the server knows:

```typescript
import { DbApiError, ErrorCode, isSubjectPristine } from 'eventsourcingdb';

try {
  await client.writeEvents([
    // events
  ], [
    isSubjectPristine('/books/42')
  ]);
} catch (error) {
  if (error instanceof DbApiError && error.code === ErrorCode.preconditionViolated) {
    // ...
  }
}
```

The v1 API does not send codes. For the errors of the v1 API that clearly match a code of the v2 API, the client SDK sets that code, so that the same code works with both APIs: `preconditionViolated`, `capacityExceeded`, `eventSchemaViolated`, and `licenseInvalid` for writing events, `eventSchemaAlreadyRegistered` and `eventSchemaViolated` for registering an event schema, `rangeUnsatisfiable` for reading events, `eventTypeUnknown` for reading an event type, and `storeReadOnly` for every request. Every other error of the v1 API has no code.

A stream that the server ends with an end item, which every stream of the v2 API except observing does, throws an error if it breaks off before that item. Observing never ends on its own, so a stream of observed events that the server closes without reporting an error throws the same error, with both APIs.

#### Knowing Whether a Write Was Stored

EventSourcingDB never stops a write halfway, so a write whose answer is lost may have been stored nonetheless. If `writeEvents` or `registerEventSchema` fails once the write may have reached the server, it throws an `OutcomeUnknownError`, whose `cause` tells what went wrong, for example a `ConnectionStalledError`, a broken connection, an abort after sending, a stream that broke off, or an answer with the HTTP status `500`:

```typescript
import { OutcomeUnknownError } from 'eventsourcingdb';

try {
  await client.writeEvents([
    // events
  ]);
} catch (error) {
  if (error instanceof OutcomeUnknownError) {
    // Find out whether the events were stored, for example by
    // reading them, before writing them again.
  }
}
```

A write certainly was not stored, and throws the error itself, only if its request never went out, for example since the client SDK could not establish a connection, or since the write was aborted or stalled while connecting, or if the server refused the write before storing anything. A request counts as gone out once its headers have been sent. Through the v2 API, the server refuses a write with every error that it describes in its answer, except one with the code `ErrorCode.storeFailed`, and with the HTTP status `400`, `401`, `408`, `413`, `429`, or `503`. Through the v1 API, it refuses a write with an HTTP status of `4xx`, `503`, or `507`. A write that the server refuses with the HTTP status `429` may be sent again after `retryAfter` seconds.

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

#### Using the `isSubjectPopulated` precondition

If you only want to write events in case a subject (such as `/books/42`) already has at least one event, import the `isSubjectPopulated` function and pass it as an array of preconditions in the second argument:

```typescript
import { isSubjectPopulated } from 'eventsourcingdb';

const writtenEvents = await client.writeEvents([
  // events
], [
  isSubjectPopulated('/books/42')
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

#### Using the `isEventQlQueryTrue` precondition

If you want to write events depending on an EventQL query, import the `isEventQlQueryTrue` function and pass it as an array of preconditions in the second argument:

```typescript
import { isEventQlQueryTrue } from 'eventsourcingdb';

const writtenEvents = await client.writeEvents([
  // events
], [
  isEventQlQueryTrue(`FROM e IN events WHERE e.type == 'io.eventsourcingdb.library.book-borrowed' PROJECT INTO COUNT() < 10`)
]);
```

*Note that the query must return a single row with a single value, which is interpreted as a boolean.*

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

#### Detecting a Stalled Connection

While a query is running, EventSourcingDB sends a heartbeat every second whenever there is no row to send. If neither a row nor a heartbeat arrives for the stall timeout, 30 seconds by default, for example because a proxy keeps the connection open but no longer passes anything through, the client SDK closes the connection and the iterator throws a `ConnectionStalledError`, see [Configuring the Stall Timeout](#configuring-the-stall-timeout):

```typescript
import { ConnectionStalledError } from 'eventsourcingdb';

try {
  for await (const row of client.runEventQlQuery(`
    FROM e IN events
    PROJECT INTO e
  `)) {
    // ...
  }
} catch (error) {
  if (error instanceof ConnectionStalledError) {
    // ...
  }
}
```

*Note that the time you spend handling a row does not count towards the stall timeout, and that aborting the query does not cause a `ConnectionStalledError`.*

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

*Note that observing never ends on its own. If the server closes the stream without reporting an error, the iterator throws an error, so that a failure does not go unnoticed. To stop observing, use `break`, `return`, or an abort signal, see [Aborting Observing](#aborting-observing).*

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

#### Detecting a Stalled Connection

While observing, EventSourcingDB sends a heartbeat every second whenever there is no event to send. If neither an event nor a heartbeat arrives for the stall timeout, 30 seconds by default, for example because a proxy keeps the connection open but no longer passes anything through, the client SDK closes the connection and the iterator throws a `ConnectionStalledError`, see [Configuring the Stall Timeout](#configuring-the-stall-timeout):

```typescript
import { ConnectionStalledError } from 'eventsourcingdb';

try {
  for await (const event of client.observeEvents('/books/42', {
    recursive: false
  })) {
    // ...
  }
} catch (error) {
  if (error instanceof ConnectionStalledError) {
    // ...
  }
}
```

*Note that the time you spend handling an event does not count towards the stall timeout, and that aborting observing does not cause a `ConnectionStalledError`.*

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

If a schema is already registered for the event type, the function throws a `DbApiError` with the code `ErrorCode.eventSchemaAlreadyRegistered`, since a schema can be neither replaced nor removed.

### Listing Subjects

To list subjects, call the `readSubjects` function with a subject as the first argument and an options object as the second argument. The `recursive` option is required. Set it to `true` to list the subject together with all its nested subjects, so that `/` lists all subjects. The function returns an asynchronous iterator, which you can use e.g. inside a `for await` loop:

```typescript
for await (const subject of client.readSubjects('/', {
  recursive: true
})) {
  // ...
}
```

If you only want to list subjects within a specific branch, provide the desired subject instead:

```typescript
for await (const subject of client.readSubjects('/books', {
  recursive: true
})) {
  // ...
}
```

To find out whether a subject exists, set the `recursive` option to `false`. The iterator then returns only the subject itself, if it exists:

```typescript
for await (const subject of client.readSubjects('/books/42', {
  recursive: false
})) {
  // ...
}
```

#### Aborting Listing

If you need to abort listing use `break` or `return` within the `for await` loop. However, this only works if there is currently an iteration going on.

To abort listing independently of that, hand over an abort signal as third argument when calling `readSubjects`, and abort the appropriate `AbortController`:

```typescript
const controller = new AbortController();

for await (const subject of client.readSubjects('/', {
  recursive: true
}, controller.signal)) {
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

Each event type has the fields `type`, which names it, `hasEvents`, which tells whether there are events of this type, and `schema`, which is the registered schema, if there is one.

#### Aborting Listing

If you need to abort listing use `break` or `return` within the `for await` loop. However, this only works if there is currently an iteration going on.

To abort listing independently of that, hand over an abort signal as argument when calling `readEventTypes`, and abort the appropriate `AbortController`:

```typescript
const controller = new AbortController();

for await (const eventType of client.readEventTypes(controller.signal)) {
  // ...
}

// Somewhere else, abort the controller, which will cause
// reading to end.
controller.abort();
```

### Listing a Specific Event Type

To list a specific event type, call the `readEventType` function with the event type as an argument. The function returns the detailed event type, which includes the schema:

```typescript
const eventType = await client.readEventType('io.eventsourcingdb.library.book-acquired');
```

If there are neither events of this type nor a registered schema, the function throws a `DbApiError` with the code `ErrorCode.eventTypeUnknown`.

### Verifying an Event's Hash

To verify the integrity of an event, call the `verifyHash` function on the event instance. This recomputes the event's hash locally and compares it to the hash stored in the event. If the hashes differ, or if the event's `data` has been changed since it was received, the function throws a `HashVerificationFailedError`:

```typescript
event.verifyHash();
```

The hash of an event tells its version. A hash that starts with `esdb:hash:v2:` is of version 2, which EventSourcingDB writes since version 1.3. A hash without a prefix is of version 1, which events written before keep. `verifyHash` supports both. If the hash is of a version the client SDK does not know, the function throws an `UnsupportedHashVersionError` that names the version, since such a hash cannot be verified, rather than being invalid:

```typescript
import { HashVerificationFailedError, UnsupportedHashVersionError } from 'eventsourcingdb';

try {
  event.verifyHash();
} catch (error) {
  if (error instanceof HashVerificationFailedError) {
    // ...
  }
  if (error instanceof UnsupportedHashVersionError) {
    // ...
  }
}
```

*Note that this only verifies the hash. If you also want to verify the signature, you can skip this step and call `verifySignature` directly, which performs a hash verification internally.*

### Verifying an Event's Signature

To verify the authenticity of an event, call the `verifySignature` function on the event instance. This requires the public key that matches the private key used for signing on the server.

The function first verifies the event's hash, and then checks the signature. If any verification step fails, it throws an error, for example a `SignatureVerificationFailedError` if the signature is invalid:

```typescript
const verificationKey = // an ed25519 public key

event.verifySignature(verificationKey);
```

### Using Testcontainers

Import the `Container` class, create an instance, call the `start` function to run a test container, get a client, run your test code, and finally call the `stop` function to stop the test container:

```typescript
import { Container } from 'eventsourcingdb';

const container = new Container();
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

By default, `Container` uses the `latest` tag of the official EventSourcingDB Docker image. To change that, call the `withImageTag` function:

```typescript
const container = new Container()
  .withImageTag('1.0.0');
```

Similarly, you can configure the port to use and the API token. Call the `withPort` or the `withApiToken` function respectively:

```typescript
const container = new Container()
  .withPort(4000)
  .withApiToken('secret');
```

By default, the `start` function gives the test container 30 seconds to become reachable, from creating it until the database answers a ping, without the time it takes to pull the image. A container that is running but does not become reachable in time is replaced by a new one, up to 3 containers in total. If the container exits before it becomes reachable, or if Docker fails, the `start` function fails at once. Every container whose start fails is removed at once. To change the 30 seconds, call the `withStartupTimeout` function with the time in milliseconds:

```typescript
const container = new Container()
  .withStartupTimeout(60_000);
```

If you want to sign events, call the `withSigningKey` function. This generates a new signing and verification key pair inside the container:

```typescript
const container = new Container()
  .withSigningKey();
```

You can retrieve the private key (for signing) and the public key (for verifying signatures) once the container has been started:

```typescript
const signingKey = container.getSigningKey();
const verificationKey = container.getVerificationKey();
```

The `signingKey` is the private key EventSourcingDB signs events with. The `verificationKey` can be passed to `verifySignature` when verifying events read from the database.

#### Configuring the Client Manually

In case you need to set up the client yourself, use the following functions to get details on the container:

- `getHost()` returns the host name
- `getMappedPort()` returns the port
- `getBaseUrl()` returns the full URL of the container
- `getApiToken()` returns the API token

## Upgrading From Version 1

Version 2 of this client SDK speaks the v2 API of EventSourcingDB 1.3 as well as the v1 API of older versions, see [Talking to Servers With and Without the v2 API](#talking-to-servers-with-and-without-the-v2-api). It brings the following breaking changes:

- **Event types:** An event type names its type in the field `type` instead of `eventType`, and tells whether it has events in the field `hasEvents` instead of `isPhantom`, which meant the opposite.

  ```typescript
  // Before
  if (!eventType.isPhantom) {
    console.log(eventType.eventType);
  }

  // After
  if (eventType.hasEvents) {
    console.log(eventType.type);
  }
  ```

- **Listing subjects:** `readSubjects` takes the subject and an options object with the required `recursive` option, instead of a base subject alone. Calling it without the option throws an error. To keep the previous behavior, set `recursive` to `true`. The abort signal moves from the second to the third argument.

  ```typescript
  // Before
  client.readSubjects('/books', signal);

  // After
  client.readSubjects('/books', { recursive: true }, signal);
  ```

- **Errors of the server:** Every error that the server reports throws a `DbApiError` with `code`, `description`, `details`, `status`, and `retryAfter`, instead of an `Error` whose message names the HTTP status, see [Handling Errors](#handling-errors).

  ```typescript
  // Before
  if (error instanceof Error && error.message.includes("'409'")) {
    // ...
  }

  // After
  if (error instanceof DbApiError && error.code === ErrorCode.preconditionViolated) {
    // ...
  }
  ```

- **Stalled streams:** `HeartbeatTimeoutError` is gone. A stream in which neither an item nor a heartbeat arrives in time throws a `ConnectionStalledError`, as every other request that stalls does, whose `cause` has the `code` `UND_ERR_BODY_TIMEOUT`.

  ```typescript
  // Before
  if (error instanceof HeartbeatTimeoutError) {
    // ...
  }

  // After
  if (error instanceof ConnectionStalledError) {
    // ...
  }
  ```

- **Failed writes:** `writeEvents` and `registerEventSchema` throw an `OutcomeUnknownError`, whose `cause` is the original error, whenever the write may have been stored nonetheless, see [Knowing Whether a Write Was Stored](#knowing-whether-a-write-was-stored). This includes aborting the signal once the write has been sent, which threw the reason of the abort before, and a write that stalls, which threw a `ConnectionStalledError` before.

  ```typescript
  // Before
  if (error instanceof ConnectionStalledError) {
    // ...
  }

  // After
  if (error instanceof OutcomeUnknownError && error.cause instanceof ConnectionStalledError) {
    // ...
  }
  ```

- **Observing that ends:** A stream of observed events that the server closes without reporting an error throws an error, instead of ending the iteration quietly. Stopping with `break`, `return`, or an abort signal still ends it without an error.

  ```typescript
  // Before
  for await (const event of client.observeEvents('/books', { recursive: true })) {
    // ...
  }
  // Reached once the server closed the stream.

  // After
  try {
    for await (const event of client.observeEvents('/books', { recursive: true })) {
      // ...
    }
  } catch (error) {
    // Reached once the server closed the stream.
  }
  ```

- **Reading through a proxy:** Against EventSourcingDB 1.3 and later, the functions that read use the HTTP method `QUERY` instead of `POST`, which a proxy in front of the database has to let through, see [Talking to Servers With and Without the v2 API](#talking-to-servers-with-and-without-the-v2-api).
