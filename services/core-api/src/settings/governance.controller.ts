import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { SettingsService } from "./settings.service";

// Tenant (dashboard) — read-only view of the platform compliance policy they operate under.
@ApiTags("governance")
@ApiCookieAuth()
@Controller("v1/governance")
@UseGuards(AuthGuard)
export class GovernanceController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.governanceView();
  }
}
