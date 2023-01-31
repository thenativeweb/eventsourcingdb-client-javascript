import { AxiosError, AxiosResponse, CanceledError, CreateAxiosDefaults, ResponseType } from 'axios';
import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import { Readable } from 'stream';
import { Client } from '../Client';
import { retryWithBackoff } from '../util/retry/retryWithBackoff';
import { CancelationError } from '../util/error/CancelationError';
import { ClientError } from '../util/error/ClientError';
import { ServerError } from '../util/error/ServerError';
import { InternalError } from '../util/error/InternalError';

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
type Response<TResponseType extends ResponseType> = Promise<
	AxiosResponse<ResponseDataType<TResponseType>>
>;

class HttpClient {
	private readonly databaseClient: Client;

	public constructor(dbClient: Client) {
		this.databaseClient = dbClient;
	}

	private getDefaultRequestConfig(withAuthorization: boolean = true): CreateAxiosDefaults {
		let configuration: CreateAxiosDefaults = {
			baseURL: this.databaseClient.configuration.baseUrl,
			timeout: this.databaseClient.configuration.timeoutMilliseconds,
			headers: {
				'X-EventSourcingDB-Protocol-Version': this.databaseClient.configuration.protocolVersion,
			},
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
				Authorization: `Bearer ${accessToken}`,
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

		let serverProtocolVersion = headers['X-EventSourcingDB-Protocol-Version'];

		if (serverProtocolVersion === '') {
			serverProtocolVersion = 'unknown version';
		}

		throw new ClientError(
			`Protocol version mismatch, server '${serverProtocolVersion}', client '${this.databaseClient.configuration.protocolVersion}.'`,
		);
	}

	public async post<TResponseType extends ResponseType>(options: {
		path: string;
		responseType: TResponseType;
		requestBody: string;
		abortController?: AbortController;
	}): Response<TResponseType> {
		let configuration = this.getDefaultRequestConfig();
		configuration = HttpClient.setContentType(configuration, 'application/json');
		configuration = HttpClient.setResponseType(configuration, options.responseType);
		const axiosInstance = axios.create(configuration);

		const abortController: AbortController = options.abortController ?? new AbortController();
		const signal = abortController.signal;

		try {
			const response = await retryWithBackoff(
				abortController,
				this.databaseClient.configuration.maxTries,
				async () => axiosInstance.post(options.path, options.requestBody, { signal }),
			);
			this.validateProtocolVersion(response.status, response.headers);

			return response;
		} catch (ex) {
			if (ex instanceof CanceledError) {
				throw new CancelationError();
			}

			if (ex instanceof AxiosError) {
				if (ex.response !== undefined) {
					if (ex.response.status >= 400 && ex.response.status < 500) {
						throw new ClientError(`Request failed with status code '${ex.response.status}'.`);
					}
					if (ex.response.status >= 500 && ex.response.status < 600) {
						throw new ServerError(`Request failed with status code '${ex.response.status}'.`);
					}
				} else if (ex.request !== undefined) {
					throw new ServerError('No response received.');
				} else {
					throw new InternalError('Failed to setup request.');
				}
			}

			throw ex;
		}
	}

	public async get<TResponseType extends ResponseType>(options: {
		path: string;
		responseType: TResponseType;
		abortController?: AbortController;
		withAuthorization?: boolean;
	}): Response<TResponseType> {
		let configuration = this.getDefaultRequestConfig(options.withAuthorization);
		configuration = HttpClient.setResponseType(configuration, options.responseType);
		const axiosInstance = axios.create(configuration);

		const abortController: AbortController = options.abortController ?? new AbortController();
		const signal = abortController.signal;

		try {
			const response = await retryWithBackoff(
				abortController,
				this.databaseClient.configuration.maxTries,
				async () => axiosInstance.get(options.path, { signal }),
			);
			this.validateProtocolVersion(response.status, response.headers);

			return response;
		} catch (ex) {
			if (ex instanceof CanceledError) {
				throw new CancelationError();
			}

			if (ex instanceof AxiosError) {
				if (ex.response !== undefined) {
					if (ex.response.status >= 400 && ex.response.status < 500) {
						throw new ClientError(`Request failed with status code '${ex.response.status}'.`);
					}
					if (ex.response.status >= 500 && ex.response.status < 600) {
						throw new ServerError(`Request failed with status code '${ex.response.status}'.`);
					}
				} else if (ex.request !== undefined) {
					throw new ServerError('No response received.');
				} else {
					throw new InternalError('Failed to setup request.');
				}
			}

			throw ex;
		}
	}
}

export { HttpClient };
