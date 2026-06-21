import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { ConfigService } from "@nestjs/config"; // <--- تغییر
import { BillingService } from "./billing.service";

@ApiExcludeController()
@Controller("billing")
export class BillingCallbackController {
  constructor(
    private readonly billing: BillingService,
    private readonly configService: ConfigService, // <--- تغییر
  ) {}

  @Get("callback/:transactionId")
  async callback(
    @Param("transactionId") transactionId: string,
    @Query() query: Record<string, string>,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.billing.gatewayCallback(transactionId, query ?? {});
    const url = `${this.configService.get("PUBLIC_BASE_URL")}/billing/result?status=${result.ok ? "ok" : "failed"}&tx=${transactionId}`;
    await reply.header("location", url).code(302).send();
  }
}