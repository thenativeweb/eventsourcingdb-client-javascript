import type { Readable } from 'node:stream';
import type { AxiosResponse, CreateAxiosDefaults, ResponseType } from 'axios';
import { AxiosError, CanceledError } from 'axios';
import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import type { Client } from '../Client.js';
import { CancelationError } from '../util/error/CancelationError.js';
import { ClientError } from '../util/error/ClientError.js';
import { CustomError } from '../util/error/CustomError.js';
import { InternalError } from '../util/error/InternalError.js';
import { ServerError } from '../util/error/ServerError.js';
import { RetryError } from '../util/retry/RetryError.js';
import { retryWithBackoff } from '../util/retry/retryWithBackoff.js';

// biome-ignore lint/style/useNamingConvention: We want to use this naming convention
type ResponseDataType<TResponseType extends ResponseType> = TResponseType extends 'arraybuffer'
	? ArrayBuffer
	: TResponseType extends 'blob'
		? Blob
		: TResponseType extends 'document'
			? unknown
			: TResponseType extends 'json'
				? unknown
				: TResponseType extends 'text'
					? string
					: TResponseType extends 'stream'
						? Readable
						: never;
// biome-ignore lint/style/useNamingConvention: We want to use this naming convention
type Response<TResponseType extends ResponseType> = AxiosResponse<
	ResponseDataType<TResponseType>,
	unknown
>;

class HttpClient {
	private readonly databaseClient: Client;

	public constructor(dbClient: Client) {
		this.databaseClient = dbClient;
	}

	private getDefaultRequestConfig(withAuthorization = true): CreateAxiosDefaults {
		let configuration: CreateAxiosDefaults = {
			// biome-ignore lint/style/useNamingConvention: We want to use this naming convention
			baseURL: this.databaseClient.configuration.baseUrl,
			timeout: this.databaseClient.configuration.timeoutMilliseconds,
			headers: {
				'X-EventSourcingDB-Protocol-Version': this.databaseClient.configuration.protocolVersion,
			},
			validateStatus: () => true,
		};

		if (withAuthorization && this.databaseClient.configuration.accessToken !== undefined) {
			configuration = HttpClient.setAuthorization(
				configuration,
				this.databaseClient.configuration.accessToken,
			);
		}

		return configuration;
	}

	private static setContentType(
		configuration: CreateAxiosDefaults,
		contentType: string,
	): CreateAxiosDefaults {
		return {
			...configuration,
			headers: {
				...configuration.headers,
				'Content-Type': contentType,
			} as Record<string, unknown>,
		};
	}

	private static setAuthorization(
		configuration: CreateAxiosDefaults,
		accessToken: string,
	): CreateAxiosDefaults {
		return {
			...configuration,
			headers: {
				...configuration.headers,
				authorization: `Bearer ${accessToken}`,
			} as Record<string, unknown>,
		};
	}

	private static setResponseType(
		configuration: CreateAxiosDefaults,
		responseType: ResponseType,
	): CreateAxiosDefaults {
		return {
			...configuration,
			responseType,
		};
	}

	public validateProtocolVersion(httpStatusCode: number, headers: Record<string, unknown>): void {
		if (httpStatusCode !== StatusCodes.UNPROCESSABLE_ENTITY) {
			return;
		}

		let serverProtocolVersion = headers['x-eventsourcingdb-protocol-version'];

		if (serverProtocolVersion === undefined) {
			serverProtocolVersion = 'unknown version';
		}

		throw new ClientError(
			`Protocol version mismatch, server '${serverProtocolVersion}', client '${this.databaseClient.configuration.protocolVersion}.'`,
		);
	}

	// biome-ignore lint/style/useNamingConvention: We want to use this naming convention
	public async post<TResponseType extends ResponseType>(options: {
		path: string;
		responseType: TResponseType;
		requestBody: string;
		abortController?: AbortController;
	}): Promise<Response<TResponseType>> {
		let configuration = this.getDefaultRequestConfig();
		configuration = HttpClient.setContentType(configuration, 'application/json');
		configuration = HttpClient.setResponseType(configuration, options.responseType);
		const axiosInstance = axios.create(configuration);

		const abortController: AbortController = options.abortController ?? new AbortController();
		const signal = abortController.signal;

		try {
			const response = await retryWithBackoff<Response<TResponseType>>(
				abortController,
				this.databaseClient.configuration.maxTries,
				async () => {
					const response = await axiosInstance.post(options.path, options.requestBody, { signal });
					if (response.status >= 500 && response.status < 600) {
						return {
							retry: new ServerError(`Request failed with status code '${response.status}'.`),
						};
					}

					this.validateProtocolVersion(response.status, response.headers);

					if (response.status >= 400 && response.status < 500) {
						throw new ClientError(`Request failed with status code '${response.status}'.`);
					}

					return { return: response };
				},
			);

			return response;
		} catch (ex) {
			if (ex instanceof RetryError) {
				throw new ServerError(ex.message);
			}
			if (ex instanceof CustomError) {
				throw ex;
			}

			if (ex instanceof CanceledError) {
				throw new CancelationError();
			}

			if (ex instanceof AxiosError) {
				if (ex.request !== undefined) {
					throw new ServerError('No response received.');
				}
				throw new InternalError('Failed to setup request.');
			}

			throw new InternalError(ex);
		}
	}

	// biome-ignore lint/style/useNamingConvention: We want to use this naming convention
	public async get<TResponseType extends ResponseType>(options: {
		path: string;
		responseType: TResponseType;
		abortController?: AbortController;
		withAuthorization?: boolean;
	}): Promise<Response<TResponseType>> {
		let configuration = this.getDefaultRequestConfig(options.withAuthorization);
		configuration = HttpClient.setResponseType(configuration, options.responseType);
		const axiosInstance = axios.create(configuration);

		const abortController: AbortController = options.abortController ?? new AbortController();
		const signal = abortController.signal;

		try {
			const response = await retryWithBackoff<Response<TResponseType>>(
				abortController,
				this.databaseClient.configuration.maxTries,
				async () => {
					const response = await axiosInstance.get(options.path, { signal });

					if (response.status >= 500 && response.status < 600) {
						return {
							retry: new ServerError(`Request failed with status code '${response.status}'.`),
						};
					}

					this.validateProtocolVersion(response.status, response.headers);

					if (response.status >= 400 && response.status < 500) {
						throw new ClientError(`Request failed with status code '${response.status}'.`);
					}

					return { return: response };
				},
			);
			this.validateProtocolVersion(response.status, response.headers);

			return response;
		} catch (ex) {
			if (ex instanceof RetryError) {
				throw new ServerError(ex.message);
			}
			if (ex instanceof CustomError) {
				throw ex;
			}

			if (ex instanceof CanceledError) {
				throw new CancelationError();
			}

			if (ex instanceof AxiosError) {
				if (ex.request !== undefined) {
					throw new ServerError('No response received.');
				}
				throw new InternalError('Failed to setup request.');
			}

			throw new InternalError(ex);
		}
	}
}

export { HttpClient };
