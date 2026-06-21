import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { IsString, Length } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { BillingService } from "./billing.service";

class CheckoutDto {
  @IsString() @Length(1, 64) plan!: string; // validated against the live plan catalog in the service
}
class RedeemDto {
  @IsString() @Length(4, 40) code!: string;
}

@ApiTags("billing")
@ApiCookieAuth()
@Controller("v1/billing")
@UseGuards(AuthGuard, RolesGuard)
@Roles("tenant_admin")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("subscription")
  subscription(@Req() req: AuthedRequest) {
    return this.billing.currentSubscription(req.rls);
  }

  @Post("checkout")
  checkout(@Req() req: AuthedRequest, @Body() body: CheckoutDto) {
    return this.billing.checkout(req.rls, body.plan);
  }

  @Post("redeem")
  redeem(@Req() req: AuthedRequest, @Body() body: RedeemDto) {
    return this.billing.redeem(req.rls, body.code.trim().toUpperCase());
  }
}
