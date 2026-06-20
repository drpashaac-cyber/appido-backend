import { type AuthedRequest } from "../auth/auth.guard";
import { FlywheelService } from "./flywheel.service";
declare class GoldenDto {
    task: string;
    input: string;
    expected: string;
    note?: string;
}
declare class RunEvalDto {
    task: string;
    model?: string;
}
export declare class FlywheelAdminController {
    private readonly flywheel;
    constructor(flywheel: FlywheelService);
    listGolden(req: AuthedRequest, task?: string): Promise<{
        id: string;
        createdAt: Date;
        note: string;
        task: string;
        input: string;
        expected: string;
    }[]>;
    addGolden(req: AuthedRequest, body: GoldenDto): Promise<{
        id: string;
    }>;
    listEvals(req: AuthedRequest): Promise<{
        at: Date;
        id: string;
        model: string;
        task: string;
        total: number;
        passed: number;
        avgScore: number;
        detail: Record<string, unknown>[];
    }[]>;
    runEval(req: AuthedRequest, body: RunEvalDto): Promise<{
        accepted: boolean;
    }>;
}
export {};
