import fs from 'node:fs';
import path from 'node:path';

const versionRegex = /^FROM\sthenativeweb\/eventsourcingdb:(.+)$/mu;

const getImageVersionFromDockerfile = (): string => {
	const dockerfile = path.join(import.meta.dirname, '..', 'docker', 'Dockerfile');
	const data = fs.readFileSync(dockerfile, 'utf-8');

	const matches = data.match(versionRegex);
	const version = matches?.[1];

	if (version === undefined) {
		throw new Error('Failed to find image version in Dockerfile.');
	}

	return version;
};

export { getImageVersionFromDockerfile };
