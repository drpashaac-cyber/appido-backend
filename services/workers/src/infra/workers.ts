import { Worker, type Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";

import type { LiteLlmClient } from "@appido/ai";
import type { SecretCipher } from "@appido/crypto";
import type { DbHandle } from "@appido/db";
import type { PaymentEnv } from "@appido/payments";

import { makeAiReplyProcessor } from "../processors/ai-reply";
import { makeGrowthProcessor } from "../processors/growth";
import { makePaymentWatchProcessor } from "../processors/payment-watch";
import { makeRetentionProcessor } from "../processors/retention";
import { makeTgIngestProcessor } from "../processors/tg-ingest";

interface WorkerConfig {
  PUBLIC_BASE_URL?: string;
  PUBLIC_APP_URL?: string;
  [key: string]: unknown;
}

export interface CreateWorkersInput {
  dbh: DbHandle;
  pub: Redis;
  connection: Redis;
  aiReplyQueue: Queue;
  aiClient: LiteLlmClient | null;
  cipher: SecretCipher | null;
  paymentEnv: PaymentEnv;
  log: Logger;
  config?: WorkerConfig;
}

export function createWorkers(input: CreateWorkersInput): Worker[] {
  const publicBaseUrl =
    typeof input.config?.PUBLIC_BASE_URL === "string"
      ? input.config.PUBLIC_BASE_URL
      : typeof input.config?.PUBLIC_APP_URL === "string"
        ? input.config.PUBLIC_APP_URL
        : undefined;

  const paymentWatchProcessor = makePaymentWatchProcessor(
    input.dbh,
    input.cipher,
    input.paymentEnv,
    input.log,
  );

  return [
    new Worker(
      "tg-ingest",
      makeTgIngestProcessor(input.dbh, input.pub, input.aiReplyQueue, input.log),
      { connection: input.connection },
    ),
    new Worker(
      "ai-reply",
      makeAiReplyProcessor(
        input.dbh,
        input.pub,
        input.aiClient,
        input.cipher,
        { publicBaseUrl, paymentEnv: input.paymentEnv },
        input.log,
      ),
      { connection: input.connection },
    ),
    new Worker("payment-watch", async () => paymentWatchProcessor(), {
      connection: input.connection,
    }),
    new Worker(
      "growth",
      makeGrowthProcessor(input.dbh, input.pub, input.aiClient, input.cipher, input.log),
      { connection: input.connection },
    ),
    new Worker("maintenance", makeRetentionProcessor(input.dbh, input.log), {
      connection: input.connection,
    }),
  ];
}
