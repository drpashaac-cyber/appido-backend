"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initOtel = initOtel;
/**
 * Distributed tracing — enabled only when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 * Defensive: never blocks boot. Matures (collector, per-tenant dashboards) in P7.
 */
async function initOtel(config) {
    if (!config.OTEL_EXPORTER_OTLP_ENDPOINT)
        return;
    try {
        const { NodeSDK } = await Promise.resolve().then(() => __importStar(require("@opentelemetry/sdk-node")));
        const { getNodeAutoInstrumentations } = await Promise.resolve().then(() => __importStar(require("@opentelemetry/auto-instrumentations-node")));
        const { OTLPTraceExporter } = await Promise.resolve().then(() => __importStar(require("@opentelemetry/exporter-trace-otlp-http")));
        const sdk = new NodeSDK({
            traceExporter: new OTLPTraceExporter({
                url: `${config.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
            }),
            instrumentations: [getNodeAutoInstrumentations()],
        });
        sdk.start();
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("OTel init failed (continuing without tracing):", err.message);
    }
}
//# sourceMappingURL=otel.js.map