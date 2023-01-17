import { ClientConfiguration } from './ClientConfiguration';
import { getDefaultConfiguration } from './getDefaultConfiguration';

class Client {
  private readonly clientConfiguration: ClientConfiguration;

  public constructor (baseUrl: string, config?: Partial<Omit<ClientConfiguration, 'baseUrl'>>) {
    this.clientConfiguration = {
      ...getDefaultConfiguration(baseUrl),
      ...config
    };
  }
}

export { Client };
