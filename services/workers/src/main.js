"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const pino_1 = __importDefault(require("pino"));
const config_1 = require("@appido/config");
const db_1 = require("@appido/db");
const ai_1 = require("@appido/ai");
const crypto_1 = require("@appido/crypto");
const tg_ingest_1 = require("./processors/tg-ingest");
const retention_1 = require("./processors/retention");
const ai_reply_1 = require("./processors/ai-reply");
const payment_watch_1 = require("./processors/payment-watch");
const growth_1 = require("./processors/growth");
const log = (0, pino_1.default)({ name: "workers", level: process.env.LOG_LEVEL || "info" });
const config = (0, config_1.loadConfig)();
// BullMQ requires maxRetriesPerRequest = null on its connections.
// @ts-ignore
const connection = new ioredis_1.default(config.REDIS_URL, { maxRetriesPerRequest: null });
// @ts-ignore
const pub = new ioredis_1.default(config.REDIS_URL, { maxRetriesPerRequest: null }); // realtime publisher
const dbh = (0, db_1.createDb)(config.APP_DATABASE_URL ?? config.DATABASE_URL);
const jobDefaults = {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
};
// @ts-ignore
const aiReplyQueue = new bullmq_1.Queue("ai-reply", { connection, defaultJobOptions: jobDefaults });
// @ts-ignore
const paymentWatchQueue = new bullmq_1.Queue("payment-watch", { connection, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 } });
// @ts-ignore
const growthQueue = new bullmq_1.Queue("growth", { connection, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 } });
// @ts-ignore
const maintenanceQueue = new bullmq_1.Queue("maintenance", { connection, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 } });
const aiClient = config.LITELLM_BASE_URL && config.LITELLM_MASTER_KEY
    ? new ai_1.LiteLlmClient(config.LITELLM_BASE_URL, config.LITELLM_MASTER_KEY)
    : null;
const cipherKeys = (0, crypto_1.buildKeyList)(config.SECRETS_MASTER_KEY, config.SECRETS_MASTER_KEYS);
const cipher = cipherKeys.length ? new crypto_1.SecretCipher(cipherKeys) : null;
const paymentEnv = { tronApiKey: config.TRON_API_KEY, bscscanApiKey: config.BSCSCAN_API_KEY, tonApiKey: config.TON_API_KEY };
if (!aiClient)
    log.warn("LITELLM not configured — ai-reply jobs will skip");
const workers = [
    // @ts-ignore
    new bullmq_1.Worker("tg-ingest", (0, tg_ingest_1.makeTgIngestProcessor)(dbh, pub, aiReplyQueue, log), { connection, concurrency: 10 }),
    // @ts-ignore
    new bullmq_1.Worker("ai-reply", (0, ai_reply_1.makeAiReplyProcessor)(dbh, pub, aiClient, cipher, {
        publicBaseUrl: config.PUBLIC_BASE_URL,
        paymentEnv,
    }, log), { connection, concurrency: 5 }),
    // @ts-ignore
    new bullmq_1.Worker("payment-watch", (0, payment_watch_1.makePaymentWatchProcessor)(dbh, cipher, paymentEnv, log), { connection, concurrency: 1 }),
    // @ts-ignore
    new bullmq_1.Worker("growth", (0, growth_1.makeGrowthProcessor)(dbh, pub, aiClient, cipher, log), { connection, concurrency: 2 }),
    // @ts-ignore
    new bullmq_1.Worker("maintenance", (0, retention_1.makeRetentionProcessor)(dbh, log), { connection, concurrency: 1 }),
];
// repeatable on-chain scan (idempotent by jobId across restarts)
void paymentWatchQueue
    .add("scan", {}, { repeat: { every: 60_000 }, jobId: "payment-watch-scan", removeOnComplete: true })
    .catch((err) => log.error({ err: err.message }, "failed to schedule payment-watch"));
// nightly flywheel attribution (paid → ai_usage.outcome) — see AI-STRATEGY.md
void growthQueue
    .add("attribute", {}, { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: "flywheel-attribute", removeOnComplete: true })
    .catch((err) => log.error({ err: err.message }, "failed to schedule flywheel attribution"));
// nightly data-retention purge (no-op unless data_retention_days > 0) — see governance policy
void maintenanceQueue
    .add("retention-purge", {}, { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: "retention-purge", removeOnComplete: true })
    .catch((err) => log.error({ err: err.message }, "failed to schedule retention purge"));
// outbox relay: publish durable events (payments, subscriptions) at-least-once
const relayTimer = setInterval(() => {
    void (0, db_1.relayOutbox)(dbh.pool, (channel, message) => pub.publish(channel, message)).catch((err) => log.error({ err: err.message }, "outbox relay failed"));
}, 2000);
for (const w of workers) {
    w.on("failed", (job, err) => {
        log.error({ queue: w.name, id: job?.id, err: err.message }, "job failed");
        if (!job)
            return;
        const maxAttempts = job.opts?.attempts ?? 1;
        if (job.attemptsMade < maxAttempts)
            return; // BullMQ will retry
        void (0, db_1.runWithRls)(dbh.pool, { platform: true }, (tx) => tx.insert(db_1.schema.deadLetters).values({ queue: w.name, jobName: job.name, payload: (job.data ?? {}), error: err.message.slice(0, 500) })).catch((e) => log.error({ e: e.message }, "dlq insert failed"));
    });
}
async function shutdown(signal) {
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
//# sourceMappingURL=main.js.map