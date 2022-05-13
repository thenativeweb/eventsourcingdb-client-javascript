# eventsourcingdb

eventsourcingdb is the JavaScript client for EventSourcingDB.

## Status

| Category         | Status                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Version          | [![npm](https://img.shields.io/npm/v/eventsourcingdb)](https://www.npmjs.com/package/eventsourcingdb)                                                      |
| Build            | ![GitHub Actions](https://github.com/thenativeweb/eventsourcingdb-client-javascript/workflows/Release/badge.svg?branch=main) |
| License          | ![GitHub](https://img.shields.io/github/license/thenativeweb/eventsourcingdb-client-javascript)                                                                         |

## Installation

```shell
$ npm install eventsourcingdb
```

## Quick Start

First you need to add a reference to `eventsourcingdb` to your application.

```javascript
const { EventSourcingDbClient } = require('eventsourcingdb');
```

If you use TypeScript, use the following code instead:

```typescript
import { EventSourcingDbClient } from 'eventsourcingdb';
```

## Running quality assurance

To run quality assurance for this module use [roboter](https://www.npmjs.com/package/roboter):

```shell
$ npx roboter
```
