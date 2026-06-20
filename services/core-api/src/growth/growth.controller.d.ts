import { type AuthedRequest } from "../auth/auth.guard";
import { GrowthService } from "./growth.service";
declare class ScoreDto {
    limit?: number;
    activeWithinDays?: number;
}
declare class SegmentDto {
    name: string;
    criteria: Record<string, unknown>;
}
declare class CampaignDto {
    name: string;
    channelId?: string;
    goal?: string;
    bodyText?: string;
    segmentId?: string;
    criteria?: Record<string, unknown>;
}
declare class CopyDto {
    tone?: string;
    language?: string;
    product?: string;
}
export declare class GrowthController {
    private readonly growth;
    constructor(growth: GrowthService);
    score(req: AuthedRequest, body: ScoreDto): Promise<{
        accepted: boolean;
    }>;
    leads(req: AuthedRequest, minScore?: string, limit?: string): Promise<{
        id: string;
        name: string;
        handle: string;
        tag: "hot" | "warm" | "cold" | "vip";
        intent: number;
        ltvCents: number;
        tags: string[];
        isVip: boolean;
        segment: string;
    }[]>;
    segments(req: AuthedRequest): Promise<({
        name: string;
        tenantId: string;
        id: string;
        createdAt: Date;
        criteria: Record<string, unknown>;
    } & {
        count: number;
    })[]>;
    createSegment(req: AuthedRequest, body: SegmentDto): Promise<{
        id: string;
    }>;
    deleteSegment(req: AuthedRequest, id: string): Promise<{
        ok: boolean;
    }>;
    campaigns(req: AuthedRequest): Promise<{
        id: string;
        name: string;
        status: string;
        goal: string | null;
        createdAt: string;
        sent: number;
        converted: number;
        total: number;
    }[]>;
    createCampaign(req: AuthedRequest, body: CampaignDto): Promise<{
        id: string;
    }>;
    campaign(req: AuthedRequest, id: string): Promise<{
        name: string;
        tenantId: string;
        id: string;
        status: "draft" | "scheduled" | "sending" | "sent" | "failed";
        createdAt: Date;
        channelId: string;
        body: string;
        criteria: Record<string, unknown>;
        goal: string;
        segmentId: string;
        scheduledAt: Date;
        stats: Record<string, unknown>;
    }>;
    copy(req: AuthedRequest, id: string, body: CopyDto): Promise<{
        budgetExceeded: boolean;
        body: string;
    }>;
    send(req: AuthedRequest, id: string): Promise<{
        accepted: boolean;
    }>;
}
export {};
