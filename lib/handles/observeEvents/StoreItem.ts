import { Event } from '../../event/Event';

interface StoreItem {
  type: 'item';
  payload: {
    event: Event;
    hash: string;
  };
}

export { StoreItem };
