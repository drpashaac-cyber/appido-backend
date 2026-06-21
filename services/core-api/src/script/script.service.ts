import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { runWithRls, schema, type DbHandle } from "@appido/db";
import { DB } from "../db/db.module";

const PLATFORM = { platform: true as const };

export interface ScriptInput {
  key?: string;
  category?: string;
  questionFa?: string;
  questionEn?: string;
  sortOrder?: number;
  enabled?: boolean;
}

// Owner-curated onboarding script (platform-global). The AI worker reads listActive().
@Injectable()
export class ScriptService {
  constructor(@Inject(DB) private readonly dbh: DbHandle) {}

  private slug(s: string): string {
    return (s || "q").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "q";
  }

  /** Active + enabled, ordered — for the AI worker and the tenant read. */
  listActive() {
    return runWithRls(this.dbh.pool, PLATFORM, (tx) =>
      tx
        .select()
        .from(schema.appidoScript)
        .where(and(eq(schema.appidoScript.active, true), eq(schema.appidoScript.enabled, true)))
        .orderBy(asc(schema.appidoScript.sortOrder)),
    );
  }

  /** All non-deleted rows (enabled + paused) — for the owner console. */
  listAll() {
    return runWithRls(this.dbh.pool, PLATFORM, (tx) =>
      tx.select().from(schema.appidoScript).where(eq(schema.appidoScript.active, true)).orderBy(asc(schema.appidoScript.sortOrder)),
    );
  }

  async create(input: ScriptInput) {
    const key = (input.key && input.key.trim()) || this.slug(input.questionEn || "");
    const [row] = await runWithRls(this.dbh.pool, PLATFORM, (tx) =>
      tx
        .insert(schema.appidoScript)
        .values({
          key,
          category: input.category || "onboard",
          questionFa: input.questionFa || "",
          questionEn: input.questionEn || "",
          sortOrder: input.sortOrder ?? 0,
          enabled: input.enabled ?? true,
        })
        .returning(),
    );
    return row;
  }

  async update(id: string, patch: ScriptInput) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.category !== undefined) set.category = patch.category;
    if (patch.questionFa !== undefined) set.questionFa = patch.questionFa;
    if (patch.questionEn !== undefined) set.questionEn = patch.questionEn;
    if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
    if (patch.enabled !== undefined) set.enabled = patch.enabled;
    const [row] = await runWithRls(this.dbh.pool, PLATFORM, (tx) =>
      tx.update(schema.appidoScript).set(set).where(eq(schema.appidoScript.id, id)).returning(),
    );
    return row ?? null;
  }

  async remove(id: string) {
    await runWithRls(this.dbh.pool, PLATFORM, (tx) =>
      tx.update(schema.appidoScript).set({ active: false, updatedAt: new Date() }).where(eq(schema.appidoScript.id, id)),
    );
    return { ok: true as const };
  }
}
