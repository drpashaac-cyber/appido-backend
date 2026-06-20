import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { PermissionsGuard } from "../authz/permissions.guard";
import { RequirePermissions } from "../authz/require-permissions.decorator";
import { SettingsService } from "./settings.service";

class SettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(365) trialDays?: number;
}

// Owner console — manage platform settings shared with the landing + dashboard.
@ApiTags("owner")
@ApiCookieAuth()
@Controller("v1/owner/settings")
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions("platform:overview")
export class SettingsAdminController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.ownerView();
  }

  @Put()
  async set(@Body() body: SettingsDto) {
    if (body.trialDays !== undefined) await this.settings.setTrialDays(body.trialDays);
    return this.settings.ownerView();
  }
}
