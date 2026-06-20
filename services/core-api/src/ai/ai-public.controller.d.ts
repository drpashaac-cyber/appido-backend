import { AiService } from "./ai.service";
declare class PublicAdvisorDto {
    question: string;
    lang?: string;
}
export declare class AiPublicController {
    private readonly ai;
    constructor(ai: AiService);
    advisor(body: PublicAdvisorDto): Promise<{
        answer: string | import("@appido/ai").TextPart[];
    }>;
}
export {};
