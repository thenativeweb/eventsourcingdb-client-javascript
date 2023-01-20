const prefixEventType = function (suffix: string): string {
	return `io.thenativeweb.eventsourcingdb.test.${suffix}`;
};

export { prefixEventType };
