import type { ContainerRuntimeClient } from 'testcontainers';

type DockerContainer = Awaited<ReturnType<ContainerRuntimeClient['container']['create']>>;

interface ContainerOutput {
	// Waits until the output has ended, and returns its last lines.
	readTail: (lineCount: number) => Promise<string>;
	detach: () => void;
}

// Follows the output of a container, stdout and stderr, from before its start
// on. The log of Docker may lag behind the exit of a container, while an
// attached stream ends only once all output has arrived.
const attachOutput = async (
	client: ContainerRuntimeClient,
	container: DockerContainer,
): Promise<ContainerOutput> => {
	const stream = await client.container.attach(container);
	const ended = new Promise<void>(resolve => {
		stream.once('end', resolve);
		stream.once('close', resolve);
	});

	let output = '';
	stream.on('data', (chunk: string): void => {
		output += chunk;
	});

	return {
		readTail: async (lineCount: number): Promise<string> => {
			await ended;

			return output.trimEnd().split('\n').slice(-lineCount).join('\n');
		},
		detach: (): void => {
			stream.destroy();
		},
	};
};

export type { ContainerOutput, DockerContainer };
export { attachOutput };
