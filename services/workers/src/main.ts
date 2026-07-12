import "dotenv/config";

import { type Job } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";

import { loadConfig } from "@appido/config";
import { createDb, relayOutbox, runWithRls, schema } from "@appido/db";
import { LiteLlmClient } from "@appido/ai";
import { SecretCipher, buildKeyList } from "@appido/crypto";

import { createQueues } from "./infra/queues";
import { createWorkers } from "./infra/workers";

const log = pino({ name: "workers", level: process.env.LOG_LEVEL || "info" });
const config = loadConfig();

// ---------------- Redis ----------------
const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const pub = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// ---------------- DB ----------------
const dbh = createDb(config.APP_DATABASE_URL ?? config.DATABASE_URL);

// ---------------- AI ----------------
const aiEnabled = process.env.APPIDO_AI_ENABLED === "true";
const aiClient =
  aiEnabled && config.LITELLM_BASE_URL && config.LITELLM_MASTER_KEY
    ? new LiteLlmClient(config.LITELLM_BASE_URL, config.LITELLM_MASTER_KEY)
    : null;

const cipherKeys = buildKeyList(
  config.SECRETS_MASTER_KEY,
  config.SECRETS_MASTER_KEYS,
);

const cipher = cipherKeys.length ? new SecretCipher(cipherKeys) : null;

const paymentEnv = {
  tronApiKey: config.TRON_API_KEY,
  bscscanApiKey: config.BSCSCAN_API_KEY,
  tonApiKey: config.TON_API_KEY,
};

if (!aiEnabled) log.warn("APPIDO_AI_ENABLED=false — AI jobs disabled");
else if (!aiClient) log.warn("LITELLM not configured — ai-reply jobs will skip");

// ---------------- Job defaults ----------------
const jobDefaults = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

// ---------------- Queues ----------------
const {
  aiReplyQueue,
  paymentWatchQueue,
  growthQueue,
  maintenanceQueue,
} = createQueues(connection, jobDefaults);

// ---------------- Workers ----------------
const workers = createWorkers({
  dbh,
  pub,
  connection,
  aiReplyQueue,
  aiClient,
  cipher,
  paymentEnv,
  log,
  config,
});

// ---------------- Schedulers ----------------
void paymentWatchQueue
  .add(
    "scan",
    {},
    {
      repeat: { every: 60_000 },
      jobId: "payment-watch-scan",
      removeOnComplete: true,
    },
  )
  .catch((err: Error) =>
    log.error({ err: err.message }, "failed payment-watch schedule"),
  );

void growthQueue
  .add(
    "attribute",
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      jobId: "flywheel-attribute",
      removeOnComplete: true,
    },
  )
  .catch((err: Error) =>
    log.error({ err: err.message }, "failed growth schedule"),
  );

void maintenanceQueue
  .add(
    "retention-purge",
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      jobId: "retention-purge",
      removeOnComplete: true,
    },
  )
  .catch((err: Error) =>
    log.error({ err: err.message }, "failed maintenance schedule"),
  );

// ---------------- Outbox relay ----------------
const relayTimer = setInterval(() => {
  void relayOutbox(dbh.pool, (channel, message) =>
    pub.publish(channel, message),
  ).catch((err: Error) =>
    log.error({ err: err.message }, "outbox relay failed"),
  );
}, 2000);

// ---------------- Failure handling ----------------
for (const w of workers) {
  w.on("failed", (job: Job | undefined, err: Error) => {
    log.error({ queue: w.name, id: job?.id, err: err.message }, "job failed");

    if (!job) return;

    const maxAttempts = job.opts?.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;

    void runWithRls(dbh.pool, { platform: true }, (tx) =>
      tx.insert(schema.deadLetters).values({
        queue: w.name,
        jobName: job.name,
        payload: (job.data ?? {}) as Record<string, unknown>,
        error: err.message.slice(0, 500),
      }),
    ).catch((e: Error) =>
      log.error({ e: e.message }, "dlq insert failed"),
    );
  });
}

// ---------------- Shutdown ----------------
async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, "shutting down workers");

  clearInterval(relayTimer);

  await Promise.all(workers.map((w) => w.close()));

  await aiReplyQueue.close();
  await paymentWatchQueue.close();
  await growthQueue.close();
  await maintenanceQueue.close();

  await dbh.pool.end();
  await pub.quit();
  await connection.quit();

  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

log.info({ queues: workers.map((w) => w.name) }, "workers up");