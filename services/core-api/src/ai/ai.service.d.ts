import { type DbHandle, type RlsContext } from "@appido/db";
import type { AppConfig } from "@appido/config";
export interface AiConfigInput {
    channelId?: string;
    model?: string;
    tone?: string;
    goal?: string;
    languages?: string[];
    guardrails?: string;
    enabled?: boolean;
}
export declare class AiService {
    private readonly dbh;
    private readonly config;
    private cached?;
    constructor(dbh: DbHandle, config: AppConfig);
    private client;
    private resolveChannel;
    getConfig(ctx: RlsContext, channelId?: string): Promise<{
        channelId: string;
        model: string;
        tone: string;
        goal: string;
        languages: string[];
        guardrails: string;
        enabled: boolean;
    }>;
    updateConfig(ctx: RlsContext, input: AiConfigInput): Promise<{
        channelId: string;
        model: string;
        tone: string;
        goal: string;
        languages: string[];
        guardrails: string;
        enabled: boolean;
    }>;
    indexKnowledge(ctx: RlsContext, input: {
        source: "file" | "product";
        sourceId?: string;
        text: string;
    }): Promise<{
        ok: boolean;
        chunks: number;
    }>;
    listKnowledge(ctx: RlsContext): Promise<{
        id: string;
        source: "file" | "product";
        sourceId: string;
        createdAt: Date;
    }[]>;
    private overBudget;
    /** Server-side revenue advisor for the dashboard (replaces the client-side call). */
    advisor(ctx: RlsContext, question: string): Promise<{
        answer: string | import("@appido/ai").TextPart[];
        budgetExceeded: boolean;
    }>;
    /** Public marketing-site advisor — no tenant, no metering. Powers the landing support widget. */
    advisorPublic(question: string, lang?: string): Promise<{
        answer: string | import("@appido/ai").TextPart[];
    }>;
    /** Dry-run the agent against a sample inbound message (dashboard playground). */
    test(ctx: RlsContext, message: string, customerId?: string): Promise<{
        reply: string;
        budgetExceeded: boolean;
        steps: number;
    }>;
    campaignCopy(ctx: RlsContext, input: {
        goal: string;
        audience: string;
        product?: string;
        tone?: string;
        language?: string;
    }): Promise<{
        body: string;
        budgetExceeded: boolean;
    }>;
}
