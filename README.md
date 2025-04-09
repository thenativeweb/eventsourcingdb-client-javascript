# eventsourcingdb

The official JavaScript client SDK for [EventSourcingDB](https://www.eventsourcingdb.io) – a purpose-built database for event sourcing.

EventSourcingDB enables you to build and operate event-driven applications with native support for writing, reading, and observing events. This client SDK provides convenient access to its capabilities in JavaScript and TypeScript.

For more information on EventSourcingDB, see its [official documentation](https://docs.eventsourcingdb.io/).

## Getting Started

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
