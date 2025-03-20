import { Image } from './docker/Image.js';

const buildDatabase = (dockerfileDirectory: string): void => {
	const image = new Image('eventsourcingdb', 'latest');
	image.build(dockerfileDirectory);
};

export { buildDatabase };
