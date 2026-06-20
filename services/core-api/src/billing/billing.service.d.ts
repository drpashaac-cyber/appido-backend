import { type DbHandle, type RlsContext } from "@appido/db";
import { type AppidoPlan } from "@appido/payments";
import type { AppConfig } from "@appido/config";
import { PlansService } from "../plans/plans.service";
export declare class BillingService {
    private readonly dbh;
    private readonly config;
    private readonly plans;
    constructor(dbh: DbHandle, config: AppConfig, plans: PlansService);
    private env;
    private gateway;
    currentSubscription(ctx: RlsContext): Promise<{
        subscription: {
            plan: string;
            status: "active" | "trialing" | "past_due" | "canceled";
            periodEnd: Date;
        };
        plans: {
            key: string;
            name: string;
            descFa: string;
            descEn: string;
            priceCents: number;
            annualCents: number;
            currency: string;
            periodDays: number;
            featuresFa: string[];
            featuresEn: string[];
            popular: boolean;
        }[];
    }>;
    checkout(ctx: RlsContext, plan: string): Promise<{
        subscriptionId: string;
        redirectUrl?: string;
        payAddress?: string;
        network?: string;
        amountCrypto?: string;
        memo?: string;
    }>;
    redeem(ctx: RlsContext, code: string): Promise<{
        ok: boolean;
        plan?: AppidoPlan;
        periodEnd?: string;
        error?: string;
    }>;
    issueCodes(_ctx: RlsContext, body: {
        plan: AppidoPlan;
        durationDays?: number;
        count?: number;
        note?: string;
    }): Promise<{
        codes: string[];
    }>;
    listCodes(_ctx: RlsContext): Promise<{
        code: string;
        id: string;
        durationDays: number;
        createdAt: Date;
        plan: "start" | "pro" | "trial";
        note: string | null;
        redeemedByTenant: string | null;
        redeemedAt: Date | null;
    }[]>;
    zarinpalCallback(subscriptionId: string, authority: string, status: string): Promise<{
        ok: boolean;
    }>;
}
