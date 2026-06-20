import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import type { AppidoPlan } from "@appido/payments";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { PermissionsGuard } from "../authz/permissions.guard";
import { RequirePermissions } from "../authz/require-permissions.decorator";
import { BillingService } from "./billing.service";

class IssueCodesDto {
  @IsIn(["start", "pro"]) plan!: AppidoPlan;
  @IsOptional() @IsInt() @Min(1) @Max(3650) durationDays?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) count?: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

// Platform owner / finance issues + lists Appido subscription activation codes.
@ApiTags("owner-billing")
@ApiCookieAuth()
@Controller("v1/owner/activation-codes")
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions("billing:manage")
export class BillingAdminController {
  constructor(private readonly billing: BillingService) {}

  @Post()
  issue(@Req() req: AuthedRequest, @Body() body: IssueCodesDto) {
    return this.billing.issueCodes(req.rls, body);
  }

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.billing.listCodes(req.rls);
  }
}
