const millisecondsPerSecond = 1000;

const formatDuration = (milliseconds: number): string => {
	if (milliseconds % millisecondsPerSecond === 0) {
		const seconds = milliseconds / millisecondsPerSecond;

		return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
	}

	return `${milliseconds} ${milliseconds === 1 ? 'millisecond' : 'milliseconds'}`;
};

export { formatDuration };
