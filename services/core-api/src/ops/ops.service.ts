import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { desc, eq } from "drizzle-orm";
import { runWithRls, schema, type DbHandle, type RlsContext } from "@appido/db";
import type { AppConfig } from "@appido/config";
import { DB } from "../db/db.module";
import { APP_CONFIG } from "../config/config.module";
import { GROWTH_QUEUE } from "../queue/queue.module";

@Injectable()
export class OpsService {
  constructor(
    @Inject(DB) private readonly dbh: DbHandle,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(GROWTH_QUEUE) private readonly growthQueue: Queue,
  ) {}

  listDeadLetters(_ctx: RlsContext) {
    return runWithRls(this.dbh.pool, { platform: true }, (tx) =>
      tx.select().from(schema.deadLetters).orderBy(desc(schema.deadLetters.failedAt)).limit(200),
    );
  }

  async replay(_ctx: RlsContext, id: string) {
    const [dl] = await runWithRls(this.dbh.pool, { platform: true }, (tx) =>
      tx.select().from(schema.deadLetters).where(eq(schema.deadLetters.id, id)).limit(1),
    );
    if (!dl) throw new NotFoundException("dead_letter_not_found");
    const conn = new IORedis(this.config.REDIS_URL, { maxRetriesPerRequest: null });
    const q = new Queue(dl.queue, { connection: conn });
    try {
      await q.add(dl.jobName ?? "job", (dl.payload ?? {}) as Record<string, unknown>);
    } finally {
      await q.close();
      await conn.quit();
    }
    await runWithRls(this.dbh.pool, { platform: true }, (tx) =>
      tx.update(schema.deadLetters).set({ replayedAt: new Date() }).where(eq(schema.deadLetters.id, id)),
    );
    return { ok: true };
  }

  async rotateSecrets(_ctx: RlsContext) {
    await this.growthQueue.add("rotate-secrets", {});
    return { accepted: true };
  }
}
