import { TracingContext } from '../../../lib';
import { TraceFlags, createTraceState } from '@opentelemetry/api';
import { assert } from 'assertthat';

suite('tracing', (): void => {
	test('can be converted to JSON correctly.', async (): Promise<void> => {
		const tracingContext = new TracingContext(
			'eb0e08452e7ee4b0d3b8b30987c37951',
			'c31bc0a7013beab8',
			TraceFlags.NONE,
			createTraceState().set('foo', 'bar'),
		);

		const json = JSON.stringify(tracingContext);

		assert
			.that(json)
			.is.equalTo(
				'{"traceId":"eb0e08452e7ee4b0d3b8b30987c37951","spanId":"c31bc0a7013beab8","traceFlags":"01","Tracestate":"foo=bar"}',
			);
	});

	test('converts TracingContext to SpanContext and back again.', async (): Promise<void> => {
		const tracingContext = new TracingContext(
			'eb0e08452e7ee4b0d3b8b30987c37951',
			'c31bc0a7013beab8',
			TraceFlags.NONE,
		);

		const spanContext = tracingContext.toSpanContext();

		const againTracingContext = TracingContext.fromSpanContext(spanContext);

		assert.that(againTracingContext).is.equalTo(tracingContext);
	});

	test('converts TracingContext to OpenTelemetryContextCarrier.', async (): Promise<void> => {
		const traceState = createTraceState().set('foo', 'bar').set('heck', 'meck');

		const tracingContext = new TracingContext(
			'eb0e08452e7ee4b0d3b8b30987c37951',
			'c31bc0a7013beab8',
			TraceFlags.NONE,
			traceState,
		);

		const openTelemetryContextCarrier = tracingContext.toOpenTelemetryContextCarrier();

		assert.that(openTelemetryContextCarrier).is.equalTo({
			traceparent: '00-eb0e08452e7ee4b0d3b8b30987c37951-c31bc0a7013beab8-00',
			tracestate: 'heck=meck,foo=bar',
		});
	});
});
