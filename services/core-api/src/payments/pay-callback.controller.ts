import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { ConfigService } from "@nestjs/config"; // <--- تغییر
import { PaymentsService } from "./payments.service";

// Public gateway return URL — every redirect gateway sends the customer's browser back here.
@ApiExcludeController()
@Controller("pay")
export class PayCallbackController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly configService: ConfigService, // <--- تغییر
  ) {}

  @Get("callback/:transactionId")
  async callback(
    @Param("transactionId") transactionId: string,
    @Query() query: Record<string, string>,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.payments.gatewayCallback(transactionId, query ?? {});
    const url = `${this.configService.get("PUBLIC_BASE_URL")}/pay/result?status=${result.ok ? "ok" : "failed"}&tx=${transactionId}`;
    await reply.header("location", url).code(302).send();
  }
}