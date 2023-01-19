import { ClientConfiguration } from './ClientConfiguration';
import { getDefaultConfiguration } from './getDefaultConfiguration';
import { observeEvents } from './handlers/observeEvents/observeEvents';
import { ObserveEventsOptions } from './handlers/observeEvents/ObserveEventsOptions';
import { StatusCodes } from 'http-status-codes';
import { StoreItem } from './handlers/observeEvents/StoreItem';

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
			`protocol version mismatch, server '${serverProtocolVersion}', client '${this.clientConfiguration.protocolVersion}'`,
		);
	}

	public observeEvents(
		subject: string,
		options: ObserveEventsOptions,
	): AsyncGenerator<StoreItem, void, void> {
		return observeEvents(this, subject, options);
	}
}

export { Client };
