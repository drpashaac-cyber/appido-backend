import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { PermissionsGuard } from "../authz/permissions.guard";
import { RequirePermissions } from "../authz/require-permissions.decorator";
import { PlansService } from "./plans.service";

class PlanDto {
  @IsOptional() @IsString() key?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() descFa?: string;
  @IsOptional() @IsString() descEn?: string;
  @IsOptional() @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @IsInt() @Min(0) annualCents?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsInt() @Min(1) periodDays?: number;
  @IsOptional() @IsArray() featuresFa?: string[];
  @IsOptional() @IsArray() featuresEn?: string[];
  @IsOptional() @IsBoolean() popular?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

// Owner console — manage the shared Appido plan catalog (Appido's OWN subscription, not tenant products).
@ApiTags("owner")
@ApiCookieAuth()
@Controller("v1/owner/plans")
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions("platform:overview")
export class PlansAdminController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() {
    return this.plans.listAll();
  }

  @Post()
  create(@Body() body: PlanDto) {
    return this.plans.create(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: PlanDto) {
    return this.plans.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.plans.remove(id);
  }
}
