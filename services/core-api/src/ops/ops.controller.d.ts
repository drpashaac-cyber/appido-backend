import { type AuthedRequest } from "../auth/auth.guard";
import { OpsService } from "./ops.service";
export declare class OpsController {
    private readonly ops;
    constructor(ops: OpsService);
    deadLetters(req: AuthedRequest): Promise<{
        error: string;
        id: string;
        payload: Record<string, unknown>;
        queue: string;
        jobName: string;
        failedAt: Date;
        replayedAt: Date;
    }[]>;
    replay(req: AuthedRequest, id: string): Promise<{
        ok: boolean;
    }>;
    rotate(req: AuthedRequest): Promise<{
        accepted: boolean;
    }>;
}
