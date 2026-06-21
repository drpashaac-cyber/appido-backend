import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { PermissionsGuard } from "../authz/permissions.guard";
import { RequirePermissions } from "../authz/require-permissions.decorator";
import { FlywheelService } from "./flywheel.service";

class GoldenDto {
  @IsString() @MaxLength(40) task!: string;
  @IsString() @MaxLength(4000) input!: string;
  @IsString() @MaxLength(4000) expected!: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
class RunEvalDto {
  @IsString() @MaxLength(40) task!: string;
  @IsOptional() @IsString() @MaxLength(60) model?: string;
}

// Platform owner: manage golden regression sets + trigger/inspect evals.
@ApiTags("owner-flywheel")
@ApiCookieAuth()
@Controller("v1/owner")
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions("platform:overview")
export class FlywheelAdminController {
  constructor(private readonly flywheel: FlywheelService) {}

  @Get("golden-cases")
  listGolden(@Req() req: AuthedRequest, @Query("task") task?: string) {
    return this.flywheel.listGolden(req.rls, task);
  }
  @Post("golden-cases")
  addGolden(@Req() req: AuthedRequest, @Body() body: GoldenDto) {
    return this.flywheel.addGolden(req.rls, body);
  }
  @Get("evals")
  listEvals(@Req() req: AuthedRequest) {
    return this.flywheel.listEvals(req.rls);
  }
  @Post("evals/run")
  runEval(@Req() req: AuthedRequest, @Body() body: RunEvalDto) {
    return this.flywheel.enqueueEval(req.rls, body);
  }
}
