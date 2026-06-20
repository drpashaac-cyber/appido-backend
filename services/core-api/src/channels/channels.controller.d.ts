import { type DbHandle } from "@appido/db";
import { type AuthedRequest } from "../auth/auth.guard";
declare class AiConfigDto {
    aiModel?: string;
    aiEnabled?: boolean;
    aiBudgetCents?: number;
    onboardingEnabled?: boolean;
}
/** RLS-scoped channels for the dashboard. Returns a SAFE projection (never the encrypted bot token)
 * plus each channel's GMV (sum of its OK transactions). */
export declare class ChannelsController {
    private readonly dbh;
    constructor(dbh: DbHandle);
    list(req: AuthedRequest): Promise<{
        id: string;
        name: string;
        username: string;
        members: number;
        botUsername: string;
        connectedAt: Date;
        aiModel: string;
        aiEnabled: boolean;
        onboardingEnabled: boolean;
        aiBudgetCents: any;
        createdAt: Date;
        revCents: number;
    }[]>;
    updateAi(req: AuthedRequest, id: string, body: AiConfigDto): Promise<{
        id: string;
        aiModel: string;
        aiEnabled: boolean;
        aiBudgetCents: any;
        onboardingEnabled: boolean;
    }>;
}
export {};
