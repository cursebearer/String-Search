/**
 * OpenTelemetry SDK initialization.
 * Loaded via --import antes do server/index.js (ver package.json scripts).
 *
 * Exporta traces e metricas via OTLP/HTTP para o OTel Collector.
 * Endpoint configuravel por env (OTEL_EXPORTER_OTLP_ENDPOINT). Default: collector local.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'string-search',
    [ATTR_SERVICE_VERSION]: '2.0.0',
    'deployment.environment': process.env.NODE_ENV || 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${OTLP_ENDPOINT}/v1/traces`,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${OTLP_ENDPOINT}/v1/metrics`,
    }),
    exportIntervalMillis: 5000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();
console.log(`[otel] tracing iniciado, exportando para ${OTLP_ENDPOINT}`);

process.on('SIGTERM', () => {
  sdk.shutdown().then(
    () => console.log('[otel] shutdown ok'),
    (err) => console.error('[otel] erro no shutdown', err),
  ).finally(() => process.exit(0));
});
