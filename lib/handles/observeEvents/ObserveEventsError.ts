interface ObserveEventsError {
  type: 'error';
  payload: {
    error: string;
  };
}

export { ObserveEventsError };
