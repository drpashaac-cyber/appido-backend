import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { FlywheelService } from "./flywheel.service";

@ApiTags("flywheel")
@ApiCookieAuth()
@Controller("v1/flywheel")
@UseGuards(AuthGuard, RolesGuard)
@Roles("tenant_admin")
export class FlywheelController {
  constructor(private readonly flywheel: FlywheelService) {}

  // "is the AI actually converting?" — per-task conversion stats
  @Get()
  stats(@Req() req: AuthedRequest) {
    return this.flywheel.stats(req.rls);
  }
}
