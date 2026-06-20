import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import type { AppConfig } from "@appido/config";
import { APP_CONFIG } from "../config/config.module";
import { BillingService } from "./billing.service";

// Public gateway return URL for an Appido subscription payment.
@ApiExcludeController()
@Controller("billing")
export class BillingCallbackController {
  constructor(
    private readonly billing: BillingService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get("callback/:subscriptionId")
  async callback(
    @Param("subscriptionId") subscriptionId: string,
    @Query("Authority") authority: string,
    @Query("Status") status: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.billing.zarinpalCallback(subscriptionId, authority ?? "", status ?? "");
    const url = `${this.config.PUBLIC_BASE_URL}/billing/result?status=${result.ok ? "ok" : "failed"}&sub=${subscriptionId}`;
    await reply.header("location", url).code(302).send();
  }
}
