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
