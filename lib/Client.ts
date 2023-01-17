import { ClientConfiguration } from './ClientConfiguration';
import { getDefaultConfiguration } from './getDefaultConfiguration';
import { observeEventsHandle } from './handles/observeEventsHandle';
import { ObserveEventsOptions } from './handles/ObserveEventsOptions';

class Client {
  private readonly clientConfiguration: ClientConfiguration;

  public constructor (baseUrl: string, config?: Partial<Omit<ClientConfiguration, 'baseUrl'>>) {
    this.clientConfiguration = {
      ...getDefaultConfiguration(baseUrl),
      ...config
    };
  }

  public observeEvents (subject: string, options: ObserveEventsOptions): void {
    observeEventsHandle(this, subject, options);
  }
}

export { Client };
