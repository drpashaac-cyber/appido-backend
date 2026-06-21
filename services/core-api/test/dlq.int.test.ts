import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { eq } from "drizzle-orm";
import { runWithRls, schema } from "@appido/db";

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_DATABASE_URL;
const HAS_REDIS = !!process.env.REDIS_URL;
const FAIL_Q = "dlq-int-fail";
const REPLAY_Q = "dlq-int-replay";

// Mirrors workers/src/main.ts: a job that exhausts retries lands in dead_letters; an owner
// replay re-enqueues the payload to the (now-fixed) queue, which succeeds.
describe.skipIf(!HAS_DB || !HAS_REDIS)("DLQ → replay", () => {
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = new Pool({ connectionString: process.env.APP_DATABASE_URL });
  const url = process.env.REDIS_URL as string;
  const qConn = new IORedis(url, { maxRetriesPerRequest: null });
  const w1Conn = new IORedis(url, { maxRetriesPerRequest: null });
  const w2Conn = new IORedis(url, { maxRetriesPerRequest: null });
  let tA = "";

  beforeAll(async () => {
    tA = (await owner.query("INSERT INTO tenants (name) VALUES ('DlqA') RETURNING id")).rows[0].id;
  });
  afterAll(async () => {
    await qConn.quit();
    await w1Conn.quit();
    await w2Conn.quit();
    if (tA) await owner.query("DELETE FROM tenants WHERE id=$1", [tA]);
    await owner.end();
    await app.end();
  });

  it("a job that exhausts retries is dead-lettered, then replays successfully", async () => {
    const failQueue = new Queue(FAIL_Q, { connection: qConn });
    const replayQueue = new Queue(REPLAY_Q, { connection: qConn });
    let failWorker: Worker | undefined;
    let replayWorker: Worker | undefined;
    try {
      const dlInserted = new Promise<void>((resolve) => {
        failWorker = new Worker(
          FAIL_Q,
          async () => {
            throw new Error("boom");
          },
          { connection: w1Conn },
        );
        failWorker.on("failed", (job, err) => {
          if (!job) return;
          const maxAttempts = job.opts?.attempts ?? 1;
          if (job.attemptsMade < maxAttempts) return;
          void runWithRls(app, { platform: true }, (tx) =>
            tx.insert(schema.deadLetters).values({ queue: FAIL_Q, jobName: job.name, payload: (job.data ?? {}) as Record<string, unknown>, error: err.message }),
          ).then(() => resolve());
        });
      });
      await failQueue.add("boom-job", { hello: "world" }, { attempts: 1 });
      await dlInserted;

      const [dl] = await runWithRls(app, { platform: true }, (q) =>
        q.select().from(schema.deadLetters).where(eq(schema.deadLetters.queue, FAIL_Q)).limit(1),
      );
      expect(dl).toBeTruthy();
      expect((dl.payload as { hello?: string }).hello).toBe("world");

      const done = new Promise<unknown>((resolve) => {
        replayWorker = new Worker(
          REPLAY_Q,
          async (job) => {
            resolve(job.data);
            return true;
          },
          { connection: w2Conn },
        );
      });
      await replayQueue.add(dl.jobName ?? "job", (dl.payload ?? {}) as Record<string, unknown>);
      const received = await done;
      expect(received).toEqual({ hello: "world" });

      await runWithRls(app, { platform: true }, (q) =>
        q.update(schema.deadLetters).set({ replayedAt: new Date() }).where(eq(schema.deadLetters.id, dl.id)),
      );
      const [after] = await runWithRls(app, { platform: true }, (q) =>
        q.select({ replayedAt: schema.deadLetters.replayedAt }).from(schema.deadLetters).where(eq(schema.deadLetters.id, dl.id)),
      );
      expect(after.replayedAt).not.toBeNull();
    } finally {
      await failWorker?.close();
      await replayWorker?.close();
      await failQueue.obliterate({ force: true }).catch(() => {});
      await replayQueue.obliterate({ force: true }).catch(() => {});
      await failQueue.close();
      await replayQueue.close();
    }
  }, 30000);
});
