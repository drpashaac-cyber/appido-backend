import { Inject, Injectable } from "@nestjs/common";
import { schema, type DbHandle } from "@appido/db";
import { DB } from "../db/db.module";

export interface AuditInput {
  actorUserId?: string;
  tenantId?: string | null;
  action: string;
  target?: string;
  meta?: unknown;
}

/** Append-only audit trail for every mutation (BACKEND.md §6). */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly dbh: DbHandle) {}

  async record(input: AuditInput): Promise<void> {
    await this.dbh.db.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      tenantId: input.tenantId ?? null,
      action: input.action,
      target: input.target,
      meta: (input.meta ?? null) as Record<string, unknown> | null,
    });
  }
}
