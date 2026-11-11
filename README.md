# eventsourcingdb

The official JavaScript client SDK for [EventSourcingDB](https://www.eventfoundation.io/products/eventsourcingdb) – a purpose-built database for event sourcing.

The complete documentation of this client SDK, including preconditions, EventQL, observing events, handling errors, Testcontainers, and upgrading, is available at **[https://www.eventfoundation.io/docs/eventsourcingdb/sdks/javascript](https://www.eventfoundation.io/docs/eventsourcingdb/sdks/javascript)**.

## Getting Started

Install the client SDK:

```shell
npm install eventsourcingdb
```

Create a client with the URL of your EventSourcingDB instance and the API token to use, and check whether the instance is reachable:

```typescript
import { Client } from 'eventsourcingdb';

const url = new URL('http://localhost:3000');
const apiToken = 'secret';

const client = new Client(url, apiToken);

await client.ping();
```

Write an event:

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

Read the events of a subject:

```typescript
for await (const event of client.readEvents('/books/42', {
  recursive: false
})) {
  // ...
}
```

For everything else, see the **[complete documentation](https://www.eventfoundation.io/docs/eventsourcingdb/sdks/javascript)**.
