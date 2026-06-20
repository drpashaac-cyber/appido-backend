import { type DbHandle, type RlsContext } from "@appido/db";
export declare class OwnerService {
    private readonly dbh;
    constructor(dbh: DbHandle);
    /** Platform-wide overview. Appido MRR vs tenant GMV reported as distinct figures. */
    overview(ctx: RlsContext): Promise<{
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
    /** Real per-tenant operational list for the owner console (platform-scoped). */
    tenants(ctx: RlsContext): Promise<{
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
    leads(ctx: RlsContext): Promise<{
        id: string;
        name: string;
        anonId: string;
        email: string;
        phone: string;
        isLead: boolean;
        props: Record<string, unknown>;
        at: string;
    }[]>;
    mrr(ctx: RlsContext): Promise<{
        mrrCents: number;
        currency: string;
        byPlan: {
            plan: string;
            subs: number;
            cents: number;
        }[];
    }>;
    gmv(ctx: RlsContext): Promise<{
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
    funnel(ctx: RlsContext): Promise<{
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
