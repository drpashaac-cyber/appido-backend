// Background queue registry. Live: tg-ingest, ai-reply (P4). Upcoming:
//   payment-watch (P5) · broadcast / renewals (P6)
export const QUEUE_NAMES = ["tg-ingest", "ai-reply"] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];
