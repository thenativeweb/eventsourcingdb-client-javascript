import { ClientConfiguration } from './ClientConfiguration';
import { getDefaultClientConfiguration } from './getDefaultClientConfiguration';
import { observeEvents } from './handlers/observeEvents/observeEvents';
import { ObserveEventsOptions } from './handlers/observeEvents/ObserveEventsOptions';
import { StatusCodes } from 'http-status-codes';
import { StoreItem } from './handlers/observeEvents/StoreItem';
import { EventCandidate } from './event/EventCandidate';
import { ping } from './handlers/ping/ping';
import { writeEvents } from './handlers/writeEvents/writeEvents';
import { EventContext } from './event/EventContext';
import { Precondition } from './handlers/writeEvents/Precondition';
import { ClientOptions } from './ClientOptions';

class Client {
	public readonly configuration: ClientConfiguration;

	public constructor(baseUrl: string, options?: ClientOptions) {
		this.configuration = {
			...getDefaultClientConfiguration(baseUrl),
			...options,
		};
	}

	public validateProtocolVersion(httpStatusCode: number, headers: Record<string, unknown>): void {
		if (httpStatusCode !== StatusCodes.UNPROCESSABLE_ENTITY) {
			return;
		}

		let serverProtocolVersion = headers['X-EventSourcingDB-Protocol-Version'];

		if (serverProtocolVersion === '') {
			serverProtocolVersion = 'unknown version';
		}

		throw new Error(
			`Protocol version mismatch, server '${serverProtocolVersion}', client '${this.configuration.protocolVersion}.'`,
		);
	}

	public observeEvents(
		abortController: AbortController,
		subject: string,
		options: ObserveEventsOptions,
	): AsyncGenerator<StoreItem, void, void> {
		return observeEvents(this, abortController, subject, options);
	}

	public writeEvents(
		eventCandidates: EventCandidate[],
		preconditions: Precondition[] = [],
	): Promise<EventContext[]> {
		return writeEvents(this, eventCandidates, preconditions);
	}

	public async ping(): Promise<void> {
		await ping(this);
	}
}

export { Client };
