import { type AuthedRequest } from "../auth/auth.guard";
import { AiService } from "./ai.service";
declare class AiConfigDto {
    channelId?: string;
    model?: string;
    tone?: string;
    goal?: string;
    languages?: string[];
    guardrails?: string;
    enabled?: boolean;
}
declare class KnowledgeDto {
    source: "file" | "product";
    sourceId?: string;
    text: string;
}
declare class AdvisorDto {
    question: string;
}
declare class AiTestDto {
    message: string;
    customerId?: string;
}
export declare class AiController {
    private readonly ai;
    constructor(ai: AiService);
    getConfig(req: AuthedRequest, channelId?: string): Promise<{
        channelId: string;
        model: string;
        tone: string;
        goal: string;
        languages: string[];
        guardrails: string;
        enabled: boolean;
    }>;
    updateConfig(req: AuthedRequest, body: AiConfigDto): Promise<{
        channelId: string;
        model: string;
        tone: string;
        goal: string;
        languages: string[];
        guardrails: string;
        enabled: boolean;
    }>;
    listKnowledge(req: AuthedRequest): Promise<{
        id: string;
        source: "file" | "product";
        sourceId: string;
        createdAt: Date;
    }[]>;
    addKnowledge(req: AuthedRequest, body: KnowledgeDto): Promise<{
        ok: boolean;
        chunks: number;
    }>;
    advisor(req: AuthedRequest, body: AdvisorDto): Promise<{
        answer: string | import("@appido/ai").TextPart[];
        budgetExceeded: boolean;
    }>;
    test(req: AuthedRequest, body: AiTestDto): Promise<{
        reply: string;
        budgetExceeded: boolean;
        steps: number;
    }>;
}
export {};
