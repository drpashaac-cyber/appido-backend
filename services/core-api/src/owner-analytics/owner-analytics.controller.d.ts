import { OwnerAnalyticsService } from "./owner-analytics.service";
export declare class OwnerAnalyticsController {
    private readonly svc;
    constructor(svc: OwnerAnalyticsService);
    overview(): Promise<import("@appido/analytics").OverviewResult>;
    mrr(): Promise<import("@appido/analytics").MrrResult>;
    gmv(days?: string): Promise<import("@appido/analytics").GmvResult>;
    funnel(): Promise<import("@appido/analytics").FunnelResult>;
    cohorts(months?: string): Promise<import("@appido/analytics").CohortRow[]>;
    conversion(): Promise<import("@appido/analytics").ConversionRow[]>;
}
