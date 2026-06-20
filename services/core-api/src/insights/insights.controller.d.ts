import { type AuthedRequest } from "../auth/auth.guard";
import { InsightsService } from "./insights.service";
export declare class InsightsController {
    private readonly insights;
    constructor(insights: InsightsService);
    summary(req: AuthedRequest): Promise<import("./insights.service").InsightsSummary>;
    revenue(req: AuthedRequest, weeks?: string): Promise<{
        weeks: number;
        series: {
            week: string;
            usd: number;
        }[];
    }>;
    funnel(req: AuthedRequest): Promise<{
        stages: import("./insights.service").FunnelStage[];
    }>;
}
