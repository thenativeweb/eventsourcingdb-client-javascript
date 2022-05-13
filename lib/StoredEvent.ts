interface StoredEvent<TData = Record<string, unknown>> {
  metadata: {
    id: number;
    timestamp: number;
    stream: string;
    name: string;
  };
  data: TData;
}

export { StoredEvent };
