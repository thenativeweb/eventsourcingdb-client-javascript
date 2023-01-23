import { Container } from './Container';
import { exec } from 'shelljs';

class Image {
	private readonly name: string;

	private readonly tag: string;

	public constructor(name: string, tag: string) {
		this.name = name;
		this.tag = tag;
	}

	public run(command: string, isDetached: boolean, doExposePorts: boolean): Container {
		let dockerCommand = 'docker run --rm';

		if (isDetached) {
			dockerCommand += ' -d';
		}
		if (doExposePorts) {
			dockerCommand += ' -P';
		}

		dockerCommand += ` ${this.getFullName()} ${command}`;

		const { code, stdout, stderr } = exec(dockerCommand, { silent: true });

		if (code !== 0) {
			throw new Error(`Run failed with output: ${stderr}`);
		}

		const containerId = stdout.trim();

		return new Container(containerId);
	}

	public build(directory: string): void {
		const { code, stderr } = exec(`docker build -t ${this.getFullName()} ${directory}`, {
			silent: true,
		});

		if (code !== 0) {
			throw new Error(`Build failed with output: ${stderr}`);
		}
	}

	private getFullName(): string {
		return `${this.name}:${this.tag}`;
	}
}

export { Image };
