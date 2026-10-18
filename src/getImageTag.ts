import process from 'node:process';
import { getImageVersionFromDockerfile } from './getImageVersionFromDockerfile.js';

// The tests run against the image tag that EVENTSOURCINGDB_IMAGE_TAG names, so
// that the pipeline can run them against several tags. Without the variable,
// they run against the tag that the Dockerfile names.
const getImageTag = (): string => {
	const imageTag = process.env.EVENTSOURCINGDB_IMAGE_TAG;

	if (imageTag !== undefined && imageTag !== '') {
		return imageTag;
	}

	return getImageVersionFromDockerfile();
};

export { getImageTag };
