import { Client } from '../Client';
import { ObserveEventsOptions } from './ObserveEventsOptions';

const observeEventsHandle = async function * (client: Client, subject: string, options: ObserveEventsOptions): AsyncGenerator<string, void, void> {};

export { observeEventsHandle };
