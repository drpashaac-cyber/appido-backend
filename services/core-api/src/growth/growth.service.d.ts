import { Queue } from "bullmq";
import { type DbHandle, type RlsContext } from "@appido/db";
import { AiService } from "../ai/ai.service";
type Criteria = Record<string, unknown>;
export declare class GrowthService {
    private readonly dbh;
    private readonly growthQueue;
    private readonly ai;
    constructor(dbh: DbHandle, growthQueue: Queue, ai: AiService);
    enqueueScore(ctx: RlsContext, body: {
        limit?: number;
        activeWithinDays?: number;
    }): Promise<{
        accepted: boolean;
    }>;
    listLeads(ctx: RlsContext, q: {
        limit?: number;
        minScore?: number;
    }): Promise<{
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
    listSegments(ctx: RlsContext): Promise<({
        name: string;
        tenantId: string;
        id: string;
        createdAt: Date;
        criteria: Record<string, unknown>;
    } & {
        count: number;
    })[]>;
    createSegment(ctx: RlsContext, body: {
        name: string;
        criteria: Criteria;
    }): Promise<{
        id: string;
    }>;
    deleteSegment(ctx: RlsContext, id: string): Promise<{
        ok: boolean;
    }>;
    listCampaigns(ctx: RlsContext): Promise<{
        id: string;
        name: string;
        status: string;
        goal: string | null;
        createdAt: string;
        sent: number;
        converted: number;
        total: number;
    }[]>;
    createCampaign(ctx: RlsContext, body: {
        name: string;
        channelId?: string;
        goal?: string;
        bodyText?: string;
        segmentId?: string;
        criteria?: Criteria;
    }): Promise<{
        id: string;
    }>;
    private loadCampaign;
    getCampaign(ctx: RlsContext, id: string): Promise<{
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
    generateCopy(ctx: RlsContext, id: string, opts: {
        tone?: string;
        language?: string;
        product?: string;
    }): Promise<{
        budgetExceeded: boolean;
        body: string;
    }>;
    send(ctx: RlsContext, id: string): Promise<{
        accepted: boolean;
    }>;
}
export {};
