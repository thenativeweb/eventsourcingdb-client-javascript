import { EventCandidate } from './EventCandidate';
import { fetch } from 'undici';
import { parseLine } from './parseLine';
import { splitLines } from './splitLines';
import { StoredEvent } from './StoredEvent';

class EventSourcingDbClient {
  private readonly urls: Record<string, string>;

  public constructor ({ baseUrl }: {
    baseUrl: string;
  }) {
    this.urls = {
      pingUrl: new URL('/ping', baseUrl).href,
      storeEventsUrl: new URL('/api/store-events', baseUrl).href,
      readEventsUrl: new URL('/api/read-events', baseUrl).href
    };
  }

  public async ping (): Promise<void> {
    let res;

    try {
      res = await fetch(this.urls.pingUrl);
    } catch {
      throw new Error('Ping failed, unexpected network error.');
    }

    if (res.status !== 200) {
      throw new Error(`Ping failed, unexpected status code (${res.status}).`);
    }
    if (await res.text() !== 'OK') {
      throw new Error('Ping failed, unexpected response.');
    }
  }

  public async storeEvents ({ events }: {
    events: EventCandidate[];
  }): Promise<void> {
    try {
      const res = await fetch(this.urls.storeEventsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(events)
      });

      if (res.status !== 200) {
        throw new Error(`Store events failed, unexpected status code (${res.status}).`);
      }
    } catch {
      throw new Error('Store events failed, unexpected network error.');
    }
  }

  public async * readEvents ({ stream }: {
    stream: string;
  }): AsyncGenerator<StoredEvent, void, undefined> {
    const abortController = new AbortController();
    const abortSignal = abortController.signal;

    try {
      let res;

      try {
        res = await fetch(this.urls.readEventsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ stream }),
          signal: abortSignal
        });
      } catch {
        throw new Error('Read events failed, unexpected network error.');
      }

      if (res.status !== 200) {
        throw new Error(`Read events failed, unexpected status code (${res.status}).`);
      }
      if (!res.body) {
        throw new Error('Read events failed, failed to access body.');
      }

      const events = res.body.
        pipeThrough(new TextDecoderStream()).
        pipeThrough(splitLines()).
        pipeThrough(parseLine());

      for await (const event of events) {
        yield event;
      }
    } finally {
      abortController.abort();
    }
  }
}

export { EventSourcingDbClient };
