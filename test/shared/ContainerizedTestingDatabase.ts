import { Container } from './docker/Container';
import { Image } from './docker/Image';

class ContainerizedTestingDatabase {
  private readonly command: string;

  private container?: Container;

  private readonly image: Image;

  private readonly options: any;

  private readonly isFirstRun = true;

  constructor (image: Image, command: string, options: any) {
    this.command = command;
    this.image = image;
    this.options = options;
  }

  private start () {
    this.container = this.image.run(this.command, true, true);
    const exposedPort = this.container.getExposedPort(3_000);
    const baseUrl = `http://localhost:${exposedPort}`;
  }
}

export { ContainerizedTestingDatabase };
