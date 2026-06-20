import { type DbHandle, type RlsContext } from "@appido/db";
import { SecretCipher } from "@appido/crypto";
import { type PayMethod } from "@appido/payments";
import type { AppConfig } from "@appido/config";
type PayKind = "key" | "wallet" | "manual";
export declare class PaymentsService {
    private readonly dbh;
    private readonly cipher;
    private readonly config;
    constructor(dbh: DbHandle, cipher: SecretCipher, config: AppConfig);
    private env;
    /** Gateway catalog from the registry (incl. "coming soon"); no secrets, safe to expose. */
    catalog(): Omit<import("@appido/payments").GatewayDef, "create">[];
    /** method -> enabled for any policy rows present (absent = enabled). */
    gatewayPolicyMap(): Promise<Record<string, boolean>>;
    /** Tenant-facing catalog with the platform policy applied (adds platformEnabled). */
    catalogWithPolicy(): Promise<{
        platformEnabled: boolean;
        method: string;
        manual?: boolean;
        kind: import("@appido/payments").CredentialKind;
        label: string;
        group: import("@appido/payments").GatewayGroup;
        crypto?: boolean;
        available: boolean;
        fields: import("@appido/payments").GatewayField[];
    }[]>;
    /** Owner view — every registry method with its platform on/off state. */
    listGatewayPolicy(): Promise<{
        method: string;
        label: string;
        group: import("@appido/payments").GatewayGroup;
        crypto: boolean;
        available: boolean;
        enabled: boolean;
    }[]>;
    /** Owner sets a method on/off for all tenants. */
    setGatewayPolicy(method: string, enabled: boolean): Promise<{
        method: string;
        enabled: boolean;
    }>;
    listCredentials(ctx: RlsContext): Promise<{
        id: string;
        method: string;
        kind: "key" | "wallet" | "manual";
        enabled: boolean;
        verifiedAt: Date;
        createdAt: Date;
    }[]>;
    upsertCredential(ctx: RlsContext, input: {
        method: PayMethod;
        kind: PayKind;
        secret?: Record<string, unknown>;
    }): Promise<{
        id: string;
        updated: boolean;
    }>;
    setEnabled(ctx: RlsContext, id: string, enabled: boolean): Promise<{
        ok: boolean;
        enabled: boolean;
    }>;
    deleteCredential(ctx: RlsContext, id: string): Promise<{
        ok: boolean;
    }>;
    /** Tenant marks an offline/manual payment as received. */
    confirmManual(ctx: RlsContext, transactionId: string): Promise<{
        ok: boolean;
        alreadyDone?: boolean;
        granted?: boolean;
    }>;
    /** Public gateway return (browser redirect): verify with the tenant's own gateway, then finalize.
     *  Works for every redirect gateway (ZarinPal/IDPay/NextPay/Stripe/PayPal). verify() is the
     *  authoritative server-to-server check; query params only short-circuit explicit cancellation. */
    gatewayCallback(transactionId: string, query: Record<string, string>): Promise<{
        ok: boolean;
    }>;
    /** Back-compat ZarinPal return → generic callback. */
    zarinpalCallback(transactionId: string, authority: string, status: string): Promise<{
        ok: boolean;
    }>;
}
export {};
