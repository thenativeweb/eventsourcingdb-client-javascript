import fs from 'node:fs';
import path from 'node:path';

const versionRegex = /^FROM\sthenativeweb\/eventsourcingdb:(.+)$/mu;

const getImageVersionFromDockerfile = (): string => {
	// biome-ignore lint/correctness/noGlobalDirnameFilename: This Node-only helper is compiled as CommonJS, where __dirname is the correct idiom.
	const dockerfile = path.join(__dirname, '..', 'docker', 'Dockerfile');
	const data = fs.readFileSync(dockerfile, 'utf-8');

	const matches = data.match(versionRegex);

	if (!matches) {
		throw new Error('Failed to find image version in Dockerfile.');
	}

	return matches[1];
};

export { getImageVersionFromDockerfile };
