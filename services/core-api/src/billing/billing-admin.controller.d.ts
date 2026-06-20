import type { AppidoPlan } from "@appido/payments";
import { type AuthedRequest } from "../auth/auth.guard";
import { BillingService } from "./billing.service";
declare class IssueCodesDto {
    plan: AppidoPlan;
    durationDays?: number;
    count?: number;
    note?: string;
}
export declare class BillingAdminController {
    private readonly billing;
    constructor(billing: BillingService);
    issue(req: AuthedRequest, body: IssueCodesDto): Promise<{
        codes: string[];
    }>;
    list(req: AuthedRequest): Promise<{
        code: string;
        id: string;
        durationDays: number;
        createdAt: Date;
        plan: "start" | "pro" | "trial";
        note: string | null;
        redeemedByTenant: string | null;
        redeemedAt: Date | null;
    }[]>;
}
export {};
