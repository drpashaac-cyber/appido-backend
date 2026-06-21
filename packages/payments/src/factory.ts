// The gateway factory now lives in the registry (single source of truth). This file re-exports it
// so existing imports of `./factory` keep working. To add a gateway, edit registry.ts only.
export {
  resolveProvider,
  isCryptoMethod,
  isManualMethod,
  paymentCatalog,
  gatewayDef,
  registeredMethods,
  GATEWAYS,
} from "./registry";
export type { GatewayDef, GatewayField, GatewayGroup, CredentialKind } from "./registry";
