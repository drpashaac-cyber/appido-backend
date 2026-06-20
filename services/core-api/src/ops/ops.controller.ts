import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { PermissionsGuard } from "../authz/permissions.guard";
import { RequirePermissions } from "../authz/require-permissions.decorator";
import { OpsService } from "./ops.service";

// Platform ops: inspect/replay dead-lettered jobs, trigger secret-key rotation.
@ApiTags("owner-ops")
@ApiCookieAuth()
@Controller("v1/owner")
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions("platform:overview")
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get("dead-letters")
  deadLetters(@Req() req: AuthedRequest) {
    return this.ops.listDeadLetters(req.rls);
  }
  @Post("dead-letters/:id/replay")
  replay(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.ops.replay(req.rls, id);
  }
  @Post("secrets/rotate")
  rotate(@Req() req: AuthedRequest) {
    return this.ops.rotateSecrets(req.rls);
  }
}
