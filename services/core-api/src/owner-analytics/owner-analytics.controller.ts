import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { PermissionsGuard } from "../authz/permissions.guard";
import { RequirePermissions } from "../authz/require-permissions.decorator";
import { OwnerAnalyticsService } from "./owner-analytics.service";

// Platform analytics dashboards. MRR (Appido subscription revenue) and GMV (platform volume)
// are reported separately and never conflated.
@ApiTags("owner-analytics")
@ApiCookieAuth()
@Controller("v1/owner/analytics")
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions("analytics:read")
export class OwnerAnalyticsController {
  constructor(private readonly svc: OwnerAnalyticsService) {}

  @Get("overview")
  overview() {
    return this.svc.overview();
  }
  @Get("mrr")
  mrr() {
    return this.svc.mrr();
  }
  @Get("gmv")
  gmv(@Query("days") days?: string) {
    return this.svc.gmv(days ? Number(days) : undefined);
  }
  @Get("funnel")
  funnel() {
    return this.svc.funnel();
  }
  @Get("cohorts")
  cohorts(@Query("months") months?: string) {
    return this.svc.cohorts(months ? Number(months) : undefined);
  }
  @Get("conversion")
  conversion() {
    return this.svc.conversion();
  }
}
