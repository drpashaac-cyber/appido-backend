import { type AuthedRequest } from "../auth/auth.guard";
import { BillingService } from "./billing.service";
declare class CheckoutDto {
    plan: string;
}
declare class RedeemDto {
    code: string;
}
export declare class BillingController {
    private readonly billing;
    constructor(billing: BillingService);
    subscription(req: AuthedRequest): Promise<{
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
    checkout(req: AuthedRequest, body: CheckoutDto): Promise<{
        subscriptionId: string;
        redirectUrl?: string;
        payAddress?: string;
        network?: string;
        amountCrypto?: string;
        memo?: string;
    }>;
    redeem(req: AuthedRequest, body: RedeemDto): Promise<{
        ok: boolean;
        plan?: import("@appido/payments").AppidoPlan;
        periodEnd?: string;
        error?: string;
    }>;
}
export {};
