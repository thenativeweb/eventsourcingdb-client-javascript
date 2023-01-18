import { ClientConfiguration } from './ClientConfiguration';
import { getDefaultConfiguration } from './getDefaultConfiguration';
import { observeEventsHandle } from './handles/observeEvents/observeEventsHandle';
import { ObserveEventsOptions } from './handles/observeEvents/ObserveEventsOptions';
import { StatusCodes } from 'http-status-codes';
import { StoreItem } from './handles/observeEvents/StoreItem';

class Client {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  readonly #clientConfiguration: ClientConfiguration;

  public constructor (baseUrl: string, config?: Partial<Omit<ClientConfiguration, 'baseUrl'>>) {
    this.#clientConfiguration = {
      ...getDefaultConfiguration(baseUrl),
      ...config
    };
  }

  public get clientConfiguration (): ClientConfiguration {
    return this.#clientConfiguration;
  }

  public validateProtocolVersion (httpStatusCode: number, headers: Record<string, any>): void {
    if (httpStatusCode !== StatusCodes.UNPROCESSABLE_ENTITY) {
      return;
    }

    let serverProtocolVersion = headers['X-EventSourcingDB-Protocol-Version'];

    if (serverProtocolVersion === '') {
      serverProtocolVersion = 'unknown version';
    }

    throw new Error(`protocol version mismatch, server '${serverProtocolVersion}', client '${this.clientConfiguration.protocolVersion}'`);
  }

  public observeEvents (subject: string, options: ObserveEventsOptions): AsyncGenerator<StoreItem, void, void> {
    return observeEventsHandle(this, subject, options);
  }
}

export { Client };
