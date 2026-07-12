import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

type AppidoGlobal = typeof globalThis & {
  __APPIDO_OTEL_STARTED__?: boolean;
  __APPIDO_OTEL_SDK__?: NodeSDK;
};

const g = globalThis as AppidoGlobal;
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (endpoint && !g.__APPIDO_OTEL_STARTED__) {
  const cleanEndpoint = endpoint.replace(/\/$/, "");

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: `${cleanEndpoint}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();
  g.__APPIDO_OTEL_STARTED__ = true;
  g.__APPIDO_OTEL_SDK__ = sdk;

  console.log(`OpenTelemetry preload started: ${process.env.OTEL_SERVICE_NAME || "appido-core-api"}`);
}
