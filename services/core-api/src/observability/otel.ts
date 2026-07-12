import type { AppConfig } from "@appido/config";

/**
 * Distributed tracing — enabled only when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 * Defensive: never blocks boot. Matures (collector, per-tenant dashboards) in P7.
 */
export async function initOtel(config: AppConfig): Promise<void> {
  if (!config.OTEL_EXPORTER_OTLP_ENDPOINT) return;
  const g = globalThis as typeof globalThis & { __APPIDO_OTEL_STARTED__?: boolean };
  if (g.__APPIDO_OTEL_STARTED__) return;
  try {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({
        url: `${config.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("OTel init failed (continuing without tracing):", (err as Error).message);
  }
}
