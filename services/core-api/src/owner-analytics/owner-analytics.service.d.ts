import type { DbHandle } from "@appido/db";
export declare class OwnerAnalyticsService {
    private readonly dbh;
    constructor(dbh: DbHandle);
    overview(): Promise<import("@appido/analytics").OverviewResult>;
    mrr(): Promise<import("@appido/analytics").MrrResult>;
    gmv(days?: number): Promise<import("@appido/analytics").GmvResult>;
    funnel(): Promise<import("@appido/analytics").FunnelResult>;
    cohorts(months?: number): Promise<import("@appido/analytics").CohortRow[]>;
    conversion(): Promise<import("@appido/analytics").ConversionRow[]>;
}
