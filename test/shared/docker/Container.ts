import { exec } from 'shelljs';

class Container {
  private readonly id: string;

  public constructor (id: string) {
    this.id = id;
  }

  public kill (): void {
    const { code, stderr } = exec(`docker kill ${this.id}`);

    if (code !== 0) {
      throw new Error(`Kill failed with output: ${stderr}`);
    }
  }

  public getExposedPort (internalPort: number): number {
    const { code, stderr, stdout } = exec(`docker inspect --format='{{(index (index .NetworkSettings.Ports "${internalPort}/tcp") 0).HostPort}} ${this.id}`);

    if (code !== 0) {
      throw new Error(`Inspect failed with output: ${stderr}`);
    }

    const exposedPortAsString = stdout.replaceAll(/\s|'/u, '');
    const exposedPort = Number.parseInt(exposedPortAsString, 10);

    if (Number.isNaN(exposedPort)) {
      throw new Error(`Could not parse port from: ${exposedPortAsString}`);
    }

    return exposedPort;
  }
}

export { Container };
