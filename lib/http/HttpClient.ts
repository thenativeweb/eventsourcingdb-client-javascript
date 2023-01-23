import { AxiosResponse, CreateAxiosDefaults, ResponseType } from 'axios';
import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import { Readable } from 'stream';
import { Client } from '../Client';
import { retryWithBackoff } from '../util/retry/retryWithBackoff';

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
	private readonly dbClient: Client;

	public constructor(dbClient: Client) {
		this.dbClient = dbClient;
	}

	private getDefaultRequestConfig(skipAuthorization: boolean = false): CreateAxiosDefaults {
		let configuration: CreateAxiosDefaults = {
			baseURL: this.dbClient.configuration.baseUrl,
			timeout: this.dbClient.configuration.timeoutMilliseconds,
			headers: {
				'X-EventSourcingDB-Protocol-Version': this.dbClient.configuration.protocolVersion,
			},
		};

		if (!skipAuthorization && this.dbClient.configuration.accessToken !== undefined) {
			configuration = HttpClient.setAuthorization(
				configuration,
				this.dbClient.configuration.accessToken,
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

		throw new Error(
			`Protocol version mismatch, server '${serverProtocolVersion}', client '${this.dbClient.configuration.protocolVersion}.'`,
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

		const response = await retryWithBackoff(
			abortController,
			this.dbClient.configuration.maxTries,
			async () => axiosInstance.post(options.path, options.requestBody, { signal }),
		);
		this.validateProtocolVersion(response.status, response.headers);

		return response;
	}

	public async get<TResponseType extends ResponseType>(options: {
		path: string;
		responseType: TResponseType;
		abortController?: AbortController;
		skipAuthorization?: boolean;
	}): Response<TResponseType> {
		let configuration = this.getDefaultRequestConfig(options.skipAuthorization);
		configuration = HttpClient.setResponseType(configuration, options.responseType);
		const axiosInstance = axios.create(configuration);

		const abortController: AbortController = options.abortController ?? new AbortController();
		const signal = abortController.signal;

		const response = await retryWithBackoff(
			abortController,
			this.dbClient.configuration.maxTries,
			async () => axiosInstance.get(options.path, { signal }),
		);
		this.validateProtocolVersion(response.status, response.headers);

		return response;
	}
}

export { HttpClient };
