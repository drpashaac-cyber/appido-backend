import { Queue, type DefaultJobOptions } from "bullmq";
import type { Redis } from "ioredis";

export interface AppidoQueues {
  aiReplyQueue: Queue;
  paymentWatchQueue: Queue;
  growthQueue: Queue;
  maintenanceQueue: Queue;
}

export function createQueues(connection: Redis, defaultJobOptions?: DefaultJobOptions): AppidoQueues {
  const options = { connection, defaultJobOptions };

  return {
    aiReplyQueue: new Queue("ai-reply", options),
    paymentWatchQueue: new Queue("payment-watch", options),
    growthQueue: new Queue("growth", options),
    maintenanceQueue: new Queue("maintenance", options),
  };
}
