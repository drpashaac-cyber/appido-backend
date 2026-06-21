import { SkipCsrf } from "../security/csrf.constants";
import { Controller, Inject, Param, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Queue } from "bullmq";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { TelegramService } from "./telegram.service";
import { safeEqual } from "./secret";
import { TG_INGEST_QUEUE } from "../queue/queue.module";

@ApiExcludeController()
@SkipThrottle()
@SkipCsrf()
@Controller("tg")
export class TelegramWebhookController {
  constructor(
    private readonly tg: TelegramService,
    @Inject(TG_INGEST_QUEUE) private readonly queue: Queue,
  ) {}

  @Post(":channelId")
  async webhook(
    @Param("channelId") channelId: string,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ ok: boolean }> {
    const raw = req.headers["x-telegram-bot-api-secret-token"];
    const provided = Array.isArray(raw) ? raw[0] : raw;
    const channel = await this.tg.getChannelForWebhook(channelId);
    if (!channel || !safeEqual(provided, channel.botSecret)) {
      void reply.status(403);
      return { ok: false };
    }
    // Fast-ack: enqueue the raw update and return 200 immediately (Telegram retries on non-2xx).
    await this.queue.add("update", { channelId, tenantId: channel.tenantId, update: req.body });
    return { ok: true };
  }
}
