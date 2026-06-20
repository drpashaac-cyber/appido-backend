import { Inject, Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { desc, eq } from "drizzle-orm";
import { runWithRls, schema, type DbHandle, type RlsContext } from "@appido/db";
import { flywheelStats } from "@appido/ai";
import { DB } from "../db/db.module";
import { GROWTH_QUEUE } from "../queue/queue.module";

@Injectable()
export class FlywheelService {
  constructor(
    @Inject(DB) private readonly dbh: DbHandle,
    @Inject(GROWTH_QUEUE) private readonly growthQueue: Queue,
  ) {}

  // tenant: my AI conversion stats per task
  stats(ctx: RlsContext) {
    return flywheelStats(this.dbh.pool, ctx.tenantId!);
  }

  // ---- owner-curated golden sets (platform-only) ----
  listGolden(_ctx: RlsContext, task?: string) {
    return runWithRls(this.dbh.pool, { platform: true }, (tx) =>
      task
        ? tx.select().from(schema.goldenCases).where(eq(schema.goldenCases.task, task)).orderBy(desc(schema.goldenCases.createdAt)).limit(500)
        : tx.select().from(schema.goldenCases).orderBy(desc(schema.goldenCases.createdAt)).limit(500),
    );
  }
  async addGolden(_ctx: RlsContext, body: { task: string; input: string; expected: string; note?: string }) {
    const [row] = await runWithRls(this.dbh.pool, { platform: true }, (tx) =>
      tx.insert(schema.goldenCases).values({ task: body.task, input: body.input, expected: body.expected, note: body.note ?? null }).returning({ id: schema.goldenCases.id }),
    );
    return { id: row.id };
  }

  // ---- evals ----
  listEvals(_ctx: RlsContext) {
    return runWithRls(this.dbh.pool, { platform: true }, (tx) => tx.select().from(schema.evalRuns).orderBy(desc(schema.evalRuns.at)).limit(100));
  }
  async enqueueEval(_ctx: RlsContext, body: { task: string; model?: string }) {
    await this.growthQueue.add("run-eval", { task: body.task, model: body.model });
    return { accepted: true };
  }
}
