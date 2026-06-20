import { Queue } from "bullmq";
import { type DbHandle, type RlsContext } from "@appido/db";
export declare class FlywheelService {
    private readonly dbh;
    private readonly growthQueue;
    constructor(dbh: DbHandle, growthQueue: Queue);
    stats(ctx: RlsContext): Promise<import("@appido/ai").TaskOutcomeStat[]>;
    listGolden(_ctx: RlsContext, task?: string): Promise<{
        id: string;
        createdAt: Date;
        note: string;
        task: string;
        input: string;
        expected: string;
    }[]>;
    addGolden(_ctx: RlsContext, body: {
        task: string;
        input: string;
        expected: string;
        note?: string;
    }): Promise<{
        id: string;
    }>;
    listEvals(_ctx: RlsContext): Promise<{
        at: Date;
        id: string;
        model: string;
        task: string;
        total: number;
        passed: number;
        avgScore: number;
        detail: Record<string, unknown>[];
    }[]>;
    enqueueEval(_ctx: RlsContext, body: {
        task: string;
        model?: string;
    }): Promise<{
        accepted: boolean;
    }>;
}
