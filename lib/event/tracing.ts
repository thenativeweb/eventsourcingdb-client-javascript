import { ValidationError } from '../util/error/ValidationError';
import {
	SpanContext,
	TraceFlags,
	TraceState,
	createTraceState,
	isValidSpanId,
	isValidTraceId,
} from '@opentelemetry/api';

class TracingContext {
	public readonly traceId: string;
	public readonly spanId: string;
	public readonly traceFlags: TraceFlags;
	public readonly traceState?: TraceState;

	public constructor(
		traceId: string,
		spanId: string,
		traceFlags: TraceFlags,
		traceState?: TraceState,
	) {
		this.traceId = traceId;
		this.spanId = spanId;
		this.traceFlags = traceFlags;
		this.traceState = traceState ?? createTraceState();
	}

	public validate(): void {
		if (!isValidTraceId(this.traceId)) {
			throw new ValidationError(
				'Failed to validate trace ID: Must be a 16-byte hex-encoded string.',
			);
		}

		if (!isValidSpanId(this.spanId)) {
			throw new ValidationError(
				'Failed to validate span ID: Must be an 8-byte hex-encoded string.',
			);
		}
	}

	public toSpanContext(): SpanContext {
		return {
			traceId: this.traceId,
			spanId: this.spanId,
			traceFlags: this.traceFlags,
			traceState: this.traceState,
			isRemote: true,
		};
	}

	public traceFlagsToString(): string {
		return this.traceFlags.toString(16).padStart(2, '0');
	}

	public traceParent(): string {
		return `00-${this.traceId}-${this.spanId}-${this.traceFlagsToString()}`;
	}

	public toExtractable(): { traceparent: string; tracestate: string } {
		return {
			traceparent: this.traceParent(),
			tracestate: this.traceState?.serialize() ?? '',
		};
	}

	public static fromSpanContext(spanContext: SpanContext): TracingContext {
		return new TracingContext(
			spanContext.traceId,
			spanContext.spanId,
			spanContext.traceFlags,
			spanContext.traceState,
		);
	}

	public toJSON(): Record<string, unknown> {
		return {
			traceId: this.traceId,
			spanId: this.spanId,
			traceFlags: this.traceFlagsToString(),
			traceState: this.traceState?.serialize() ?? '',
		};
	}
}

const parseTraceId = (traceId: unknown): string => {
	if (typeof traceId !== 'string' || !isValidTraceId(traceId)) {
		throw new ValidationError('Failed to parse trace ID: Must be a 16-byte hex-encoded string.');
	}

	return traceId;
};

const parseSpanId = (spanId: unknown): string => {
	if (typeof spanId !== 'string' || !isValidSpanId(spanId)) {
		throw new ValidationError('Failed to parse span ID: Must be an 8-byte hex-encoded string.');
	}

	return spanId;
};

const parseTraceFlags = (traceFlags: unknown): TraceFlags => {
	if (typeof traceFlags !== 'string') {
		throw new ValidationError('Failed to parse trace flags: Must be a hex-encoded byte.');
	}
	const number = parseInt(traceFlags, 16);
	if (isNaN(number)) {
		throw new ValidationError('Failed to parse trace flags: Must be a hex-encoded byte.');
	}
	if (number !== TraceFlags.NONE && number !== TraceFlags.SAMPLED) {
		throw new ValidationError(
			`Failed to parse trace flags: Must either be 'none' (0) or 'sampled' (1).`,
		);
	}
	return number;
};

const parseTraceState = (traceState: unknown): TraceState => {
	if (typeof traceState !== 'string') {
		throw new ValidationError('Failed to parse trace state.');
	}
	const parsedTraceState = createTraceState(traceState);
	return parsedTraceState;
};

const parseTracingContext = (tracingContext: unknown): TracingContext | undefined => {
	if (tracingContext === undefined || tracingContext === null) {
		return undefined;
	}

	if (typeof tracingContext !== 'object') {
		throw new ValidationError('Failed to parse tracing context: Must be an object.');
	}

	const anyTracingContext = tracingContext as {
		traceId: string;
		spanId: string;
		traceFlags: string;
		traceState: string;
	};

	const traceId = parseTraceId(anyTracingContext.traceId);
	const spanId = parseSpanId(anyTracingContext.spanId);
	const traceFlags = parseTraceFlags(anyTracingContext.traceFlags);
	const traceState = parseTraceState(anyTracingContext.traceState);

	return new TracingContext(traceId, spanId, traceFlags, traceState);
};

export {
	parseTraceId,
	parseSpanId,
	parseTraceFlags,
	parseTraceState,
	parseTracingContext,
	TracingContext,
};
