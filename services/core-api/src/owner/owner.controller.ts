import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { PermissionsGuard } from "../authz/permissions.guard";
import { RequirePermissions } from "../authz/require-permissions.decorator";
import { OwnerService } from "./owner.service";

@ApiTags("owner")
@ApiCookieAuth()
@Controller("v1/owner")
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions("platform:overview")
export class OwnerController {
  constructor(private readonly owner: OwnerService) {}

  @Get("overview")
  overview(@Req() req: AuthedRequest) {
    return this.owner.overview(req.rls);
  }

  @Get("tenants")
  tenants(@Req() req: AuthedRequest) {
    return this.owner.tenants(req.rls);
  }

  @Get("leads")
  leads(@Req() req: AuthedRequest) {
    return this.owner.leads(req.rls);
  }

  @Get("analytics/mrr")
  mrr(@Req() req: AuthedRequest) {
    return this.owner.mrr(req.rls);
  }

  @Get("analytics/gmv")
  gmv(@Req() req: AuthedRequest) {
    return this.owner.gmv(req.rls);
  }

  @Get("analytics/funnel")
  funnel(@Req() req: AuthedRequest) {
    return this.owner.funnel(req.rls);
  }
}
