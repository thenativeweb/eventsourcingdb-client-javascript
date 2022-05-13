import { EventSourcingDbClient, UnstoredEvent } from './lib';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
  const client = new EventSourcingDbClient({ baseUrl: 'http://localhost:3000' });

  await client.ping();

  // eslint-disable-next-line no-console
  console.log('Ping succeeded.');

  const userRegistered: UnstoredEvent = {
    metadata: {
      stream: '/user/7df59110-60df-492a-b810-29970025b21f',
      name: 'registered'
    },
    data: {
      username: 'jane.doe',
      password: 'secret'
    }
  };

  const userCancelled: UnstoredEvent = {
    metadata: {
      stream: '/user/7df59110-60df-492a-b810-29970025b21f',
      name: 'cancelled'
    },
    data: {}
  };

  await client.storeEvents({ events: [ userRegistered, userCancelled ]});

  // eslint-disable-next-line no-console
  console.log('Events stored.');

  for await (const event of client.readEvents({
    stream: '/user/7df59110-60df-492a-b810-29970025b21f'
  })) {
    // eslint-disable-next-line no-console
    console.log(event);
  }
})();
