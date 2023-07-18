import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Client } from '../lib';
import opentelemetry from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { credentials } from '@grpc/grpc-js';

const instanceId = process.argv[2];

(async () => {
	const sdk = new NodeSDK({
		traceExporter: new OTLPTraceExporter({
			url: 'localhost:4317',
			credentials: credentials.createInsecure(),
		}),
		instrumentations: [],
		resource: Resource.default().merge(
			new Resource({
				[SemanticResourceAttributes.SERVICE_NAME]: 'consumer-javascript',
				[SemanticResourceAttributes.SERVICE_INSTANCE_ID]: instanceId,
				[SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
			}),
		),
	});

	sdk.start();
	process.on('SIGTERM', () => {
		sdk
			.shutdown()
			.then(
				() => console.log('SDK shut down successfully'),
				(err) => console.log('Error shutting down SDK', err),
			)
			.finally(() => process.exit(0));
	});

	const client = new Client('http://localhost:3000', {
		accessToken: 'test',
	});

	for await (const storeItem of client.observeEvents(new AbortController(), '/', {
		recursive: true,
	})) {
		const activeContext = opentelemetry.propagation.extract(
			opentelemetry.context.active(),
			storeItem.event.tracingContext?.toOpenTelemetryContextCarrier(),
		);

		let span = opentelemetry.trace
			.getTracer('consumer')
			.startSpan('ConsumeEvent', {}, activeContext);

		console.log('consuming event...');
		await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));

		span.end();
	}
})();
