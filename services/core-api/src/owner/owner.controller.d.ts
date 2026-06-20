import { type AuthedRequest } from "../auth/auth.guard";
import { OwnerService } from "./owner.service";
export declare class OwnerController {
    private readonly owner;
    constructor(owner: OwnerService);
    overview(req: AuthedRequest): Promise<{
        tenants: number;
        channels: number;
        customers: number;
        activeSubscriptions: number;
        mrrUsd: number;
        gmvUsd: number;
        aiTokens: number;
        recentActivity: {
            type: string;
            at: Date;
        }[];
    }>;
    tenants(req: AuthedRequest): Promise<{
        id: string;
        name: string;
        handle: string;
        country: string;
        plan: string;
        mrrCents: number;
        gmvCents: number;
        customers: number;
        members: number;
        aiModel: string;
        aiEnabled: boolean;
        createdAt: string;
        lastActivity: string;
    }[]>;
    leads(req: AuthedRequest): Promise<{
        id: string;
        name: string;
        anonId: string;
        email: string;
        phone: string;
        isLead: boolean;
        props: Record<string, unknown>;
        at: string;
    }[]>;
    mrr(req: AuthedRequest): Promise<{
        mrrCents: number;
        currency: string;
        byPlan: {
            plan: string;
            subs: number;
            cents: number;
        }[];
    }>;
    gmv(req: AuthedRequest): Promise<{
        byCurrency: {
            currency: string;
            cents: number;
        }[];
        series: {
            day: string;
            currency: string;
            cents: number;
        }[];
    }>;
    funnel(req: AuthedRequest): Promise<{
        customers: number;
        engaged: number;
        scored: number;
        paid: number;
        rates: {
            engagedPct: number;
            scoredPct: number;
            paidPct: number;
            scoredToPaidPct: number;
        };
    }>;
}
