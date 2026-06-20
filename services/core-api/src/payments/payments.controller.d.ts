import { type AuthedRequest } from "../auth/auth.guard";
import { PaymentsService } from "./payments.service";
declare class CredentialDto {
    method: string;
    kind: "key" | "wallet" | "manual";
    secret?: Record<string, unknown>;
}
declare class EnabledDto {
    enabled: boolean;
}
export declare class PaymentsController {
    private readonly payments;
    constructor(payments: PaymentsService);
    /** Gateway catalog (incl. "coming soon", with platform policy applied) — the dashboard renders its grid from this. */
    methods(): Promise<{
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
    list(req: AuthedRequest): Promise<{
        id: string;
        method: string;
        kind: "key" | "wallet" | "manual";
        enabled: boolean;
        verifiedAt: Date;
        createdAt: Date;
    }[]>;
    upsert(req: AuthedRequest, body: CredentialDto): Promise<{
        id: string;
        updated: boolean;
    }>;
    setEnabled(req: AuthedRequest, id: string, body: EnabledDto): Promise<{
        ok: boolean;
        enabled: boolean;
    }>;
    remove(req: AuthedRequest, id: string): Promise<{
        ok: boolean;
    }>;
    confirm(req: AuthedRequest, id: string): Promise<{
        ok: boolean;
        alreadyDone?: boolean;
        granted?: boolean;
    }>;
}
export {};
