import type { FastifyReply, FastifyRequest } from "fastify";
import { Queue } from "bullmq";
import { TelegramService } from "./telegram.service";
export declare class TelegramWebhookController {
    private readonly tg;
    private readonly queue;
    constructor(tg: TelegramService, queue: Queue);
    webhook(channelId: string, req: FastifyRequest, reply: FastifyReply): Promise<{
        ok: boolean;
    }>;
}
