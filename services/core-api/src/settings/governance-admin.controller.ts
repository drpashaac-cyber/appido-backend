import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { PermissionsGuard } from "../authz/permissions.guard";
import { RequirePermissions } from "../authz/require-permissions.decorator";
import { AuditService } from "../audit/audit.service";
import { SettingsService } from "./settings.service";

class GovernanceDto {
  @IsOptional() @IsBoolean() requireOptin?: boolean;
  @IsOptional() @IsBoolean() aiRequiresConsent?: boolean;
  @IsOptional() @IsIn(["off", "mask_before_llm", "mask_at_rest"]) piiRedaction?: string;
  @IsOptional() @IsInt() @Min(0) @Max(3650) dataRetentionDays?: number;
  @IsOptional() @IsIn(["global", "eu", "us", "ir", "ru"]) residency?: string;
}

// Owner console — platform compliance policy (consent, PII handling, residency, retention).
@ApiTags("owner")
@ApiCookieAuth()
@Controller("v1/owner/governance")
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions("platform:overview")
export class GovernanceAdminController {
  constructor(private readonly settings: SettingsService, private readonly audit: AuditService) {}

  @Get()
  get() {
    return this.settings.governanceView();
  }

  @Put()
  async set(@Req() req: AuthedRequest, @Body() body: GovernanceDto) {
    const next = await this.settings.setGovernance(body);
    await this.audit.record({ actorUserId: req.user?.id, action: "governance.update", target: "platform", meta: body });
    return next;
  }
}
