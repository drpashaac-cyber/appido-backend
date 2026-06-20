// @ts-nocheck
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";
import { loadConfig } from "@appido/config";
import { createDb, relayOutbox, runWithRls, schema } from "@appido/db";
import { LiteLlmClient } from "@appido/ai";
import { SecretCipher, buildKeyList } from "@appido/crypto";
import { makeTgIngestProcessor } from "./processors/tg-ingest";
import { makeRetentionProcessor } from "./processors/retention";
import { makeAiReplyProcessor } from "./processors/ai-reply";
import { makePaymentWatchProcessor } from "./processors/payment-watch";
import { makeGrowthProcessor } from "./processors/growth";

const log = pino({ name: "workers", level: process.env.LOG_LEVEL || "info" });
const config = loadConfig();

// BullMQ requires maxRetriesPerRequest = null on its connections.
// @ts-ignore
const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
// @ts-ignore
const pub = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null }); // realtime publisher
const dbh = createDb(config.APP_DATABASE_URL ?? config.DATABASE_URL);

const jobDefaults = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};
// @ts-ignore
const aiReplyQueue = new Queue("ai-reply", { connection, defaultJobOptions: jobDefaults });
// @ts-ignore
const paymentWatchQueue = new Queue("payment-watch", { connection, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 } });
// @ts-ignore
const growthQueue = new Queue("growth", { connection, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 } });
// @ts-ignore
const maintenanceQueue = new Queue("maintenance", { connection, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 } });

const aiClient =
  config.LITELLM_BASE_URL && config.LITELLM_MASTER_KEY
    ? new LiteLlmClient(config.LITELLM_BASE_URL, config.LITELLM_MASTER_KEY)
    : null;
const cipherKeys = buildKeyList(config.SECRETS_MASTER_KEY, config.SECRETS_MASTER_KEYS);
const cipher = cipherKeys.length ? new SecretCipher(cipherKeys) : null;
const paymentEnv = { tronApiKey: config.TRON_API_KEY, bscscanApiKey: config.BSCSCAN_API_KEY, tonApiKey: config.TON_API_KEY };
if (!aiClient) log.warn("LITELLM not configured — ai-reply jobs will skip");

const workers: Worker[] = [
  // @ts-ignore
  new Worker("tg-ingest", makeTgIngestProcessor(dbh, pub, aiReplyQueue, log), { connection, concurrency: 10 }),
  // @ts-ignore
  new Worker(
    "ai-reply",
    makeAiReplyProcessor(dbh, pub, aiClient, cipher, {
      publicBaseUrl: config.PUBLIC_BASE_URL,
      paymentEnv,
    }, log),
    { connection, concurrency: 5 },
  ),
  // @ts-ignore
  new Worker("payment-watch", makePaymentWatchProcessor(dbh, cipher, paymentEnv, log), { connection, concurrency: 1 }),
  // @ts-ignore
  new Worker("growth", makeGrowthProcessor(dbh, pub, aiClient, cipher, log), { connection, concurrency: 2 }),
  // @ts-ignore
  new Worker("maintenance", makeRetentionProcessor(dbh, log), { connection, concurrency: 1 }),
];

// repeatable on-chain scan (idempotent by jobId across restarts)
void paymentWatchQueue
  .add("scan", {}, { repeat: { every: 60_000 }, jobId: "payment-watch-scan", removeOnComplete: true })
  .catch((err: unknown) => log.error({ err: (err as Error).message }, "failed to schedule payment-watch"));

// nightly flywheel attribution (paid → ai_usage.outcome) — see AI-STRATEGY.md
void growthQueue
  .add("attribute", {}, { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: "flywheel-attribute", removeOnComplete: true })
  .catch((err: unknown) => log.error({ err: (err as Error).message }, "failed to schedule flywheel attribution"));

// nightly data-retention purge (no-op unless data_retention_days > 0) — see governance policy
void maintenanceQueue
  .add("retention-purge", {}, { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: "retention-purge", removeOnComplete: true })
  .catch((err: unknown) => log.error({ err: (err as Error).message }, "failed to schedule retention purge"));

// outbox relay: publish durable events (payments, subscriptions) at-least-once
const relayTimer = setInterval(() => {
  void relayOutbox(dbh.pool, (channel, message) => pub.publish(channel, message)).catch((err: unknown) =>
    log.error({ err: (err as Error).message }, "outbox relay failed"),
  );
}, 2000);

for (const w of workers) {
  w.on("failed", (job: Job | undefined, err: Error) => {
    log.error({ queue: w.name, id: job?.id, err: err.message }, "job failed");
    if (!job) return;
    const maxAttempts = job.opts?.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return; // BullMQ will retry
    void runWithRls(dbh.pool, { platform: true }, (tx) =>
      tx.insert(schema.deadLetters).values({ queue: w.name, jobName: job.name, payload: (job.data ?? {}) as Record<string, unknown>, error: err.message.slice(0, 500) }),
    ).catch((e: unknown) => log.error({ e: (e as Error).message }, "dlq insert failed"));
  });
}

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, "shutting down workers");
  clearInterval(relayTimer);
  await Promise.all(workers.map((w) => w.close()));
  await aiReplyQueue.close();
  await paymentWatchQueue.close();
  await growthQueue.close();
  await dbh.pool.end();
  await pub.quit();
  await connection.quit();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

log.info({ queues: workers.map((w) => w.name) }, "workers up");