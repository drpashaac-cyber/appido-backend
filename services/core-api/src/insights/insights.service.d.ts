import { type DbHandle, type RlsContext } from "@appido/db";
export interface InsightsSummary {
    revenueUsd90d: number;
    revenueDeltaPct: number | null;
    customers: number;
    qualifiedLeads: number;
    conversionPct: number;
    activeSubscribers: number;
    churnPct: number | null;
}
export interface FunnelStage {
    stage: "reached" | "engaged" | "qualified" | "paid";
    count: number;
    pct: number;
}
export declare class InsightsService {
    private readonly dbh;
    constructor(dbh: DbHandle);
    /** Headline KPIs for the dashboard overview. */
    summary(ctx: RlsContext): Promise<InsightsSummary>;
    /** Weekly OK-revenue (USD) for the last `weeks` weeks, oldest → newest. */
    revenue(ctx: RlsContext, weeks?: number): Promise<{
        weeks: number;
        series: {
            week: string;
            usd: number;
        }[];
    }>;
    /** Acquisition funnel: reached → engaged (AI-managed) → qualified (intent≥threshold or warm/hot/vip) → paid. */
    funnel(ctx: RlsContext): Promise<{
        stages: FunnelStage[];
    }>;
}
