import { type DbHandle } from "@appido/db";
export interface AuditInput {
    actorUserId?: string;
    tenantId?: string | null;
    action: string;
    target?: string;
    meta?: unknown;
}
/** Append-only audit trail for every mutation (BACKEND.md §6). */
export declare class AuditService {
    private readonly dbh;
    constructor(dbh: DbHandle);
    record(input: AuditInput): Promise<void>;
}
