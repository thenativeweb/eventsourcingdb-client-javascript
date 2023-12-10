import { Image } from './docker/Image';

const buildDatabase = (dockerfileDirectory: string): void => {
	const image = new Image('eventsourcingdb', 'latest');
	image.build(dockerfileDirectory);
};

export { buildDatabase };
