import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { IsBoolean } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { PermissionsGuard } from "../authz/permissions.guard";
import { RequirePermissions } from "../authz/require-permissions.decorator";
import { PaymentsService } from "./payments.service";

class PolicyDto {
  @IsBoolean() enabled!: boolean;
}

// Owner console — platform gateway policy (applies to ALL tenants).
@ApiTags("owner")
@ApiCookieAuth()
@Controller("v1/owner/gateway-policy")
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions("platform:overview")
export class PaymentsAdminController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list() {
    return this.payments.listGatewayPolicy();
  }

  @Put(":method")
  set(@Param("method") method: string, @Body() body: PolicyDto) {
    return this.payments.setGatewayPolicy(method, body.enabled);
  }
}
