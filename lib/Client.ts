import { ClientConfiguration } from './ClientConfiguration';
import { getDefaultConfiguration } from './getDefaultConfiguration';
import { observeEvents } from './handlers/observeEvents/observeEvents';
import { ObserveEventsOptions } from './handlers/observeEvents/ObserveEventsOptions';
import { StatusCodes } from 'http-status-codes';
import { StoreItem } from './handlers/observeEvents/StoreItem';
import { EventCandidate } from './event/EventCandidate';
import { writeEvents } from './handlers/writeEvents/writeEvents';
import { EventContext } from './event/EventContext';

class Client {
	readonly #clientConfiguration: ClientConfiguration;

	public constructor(
		baseUrl: string,
		configuration?: Partial<Omit<ClientConfiguration, 'baseUrl'>>,
	) {
		this.#clientConfiguration = {
			...getDefaultConfiguration(baseUrl),
			...configuration,
		};
	}

	public get clientConfiguration(): ClientConfiguration {
		return this.#clientConfiguration;
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
			`Protocol version mismatch, server '${serverProtocolVersion}', client '${this.clientConfiguration.protocolVersion}.'`,
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
		preconditions: string[],
	): Promise<EventContext[]> {
		return writeEvents(this, eventCandidates, preconditions);
	}
}

export { Client };
