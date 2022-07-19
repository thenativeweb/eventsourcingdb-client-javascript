interface EventCandidate<TData = Record<string, unknown>> {
  metadata: {
    stream: string;
    name: string;
  };
  data: TData;
}

export { EventCandidate };
