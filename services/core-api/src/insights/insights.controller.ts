import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { InsightsService } from "./insights.service";

// Tenant dashboard insights. Auth-gated; data is auto-scoped to the caller's tenant via RLS.
@ApiTags("tenant")
@ApiCookieAuth()
@Controller("v1/insights")
@UseGuards(AuthGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get("summary")
  summary(@Req() req: AuthedRequest) {
    return this.insights.summary(req.rls);
  }

  @Get("revenue")
  revenue(@Req() req: AuthedRequest, @Query("weeks") weeks?: string) {
    return this.insights.revenue(req.rls, weeks ? Number(weeks) : undefined);
  }

  @Get("funnel")
  funnel(@Req() req: AuthedRequest) {
    return this.insights.funnel(req.rls);
  }
}
