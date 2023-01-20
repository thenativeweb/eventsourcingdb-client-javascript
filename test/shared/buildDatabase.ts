import { Image } from './docker/Image';

const buildDatabase = function (dockerfileDirectory: string): void {
	const image = new Image('eventsourcingdb', 'latest');
	image.build(dockerfileDirectory);
};

export { buildDatabase };
