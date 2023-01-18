import { isObject } from '../../util/isObject';
import { ObserveEventsError } from './ObserveEventsError';

const isObserveEventsError = function (message: unknown): message is ObserveEventsError {
  if (!isObject(message) || message.type !== 'error') {
    return false;
  }

  const { payload } = message;

  return isObject(payload) && typeof payload.error === 'string';
};

export { isObserveEventsError };
