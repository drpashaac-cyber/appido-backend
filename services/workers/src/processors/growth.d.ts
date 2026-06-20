import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import { type LiteLlmClient } from "@appido/ai";
import { type DbHandle } from "@appido/db";
import type { SecretCipher } from "@appido/crypto";
export declare function makeGrowthProcessor(dbh: DbHandle, pub: Redis, client: LiteLlmClient | null, cipher: SecretCipher | null, log: Logger): (job: Job) => Promise<unknown>;
