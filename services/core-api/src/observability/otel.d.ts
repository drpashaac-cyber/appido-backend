import type { AppConfig } from "@appido/config";
/**
 * Distributed tracing — enabled only when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 * Defensive: never blocks boot. Matures (collector, per-tenant dashboards) in P7.
 */
export declare function initOtel(config: AppConfig): Promise<void>;
