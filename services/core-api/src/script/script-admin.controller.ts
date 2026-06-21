import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { PermissionsGuard } from "../authz/permissions.guard";
import { RequirePermissions } from "../authz/require-permissions.decorator";
import { ScriptService } from "./script.service";

class ScriptDto {
  @IsOptional() @IsString() @Length(1, 64) key?: string;
  @IsOptional() @IsString() @Length(1, 32) category?: string;
  @IsOptional() @IsString() @Length(0, 400) questionFa?: string;
  @IsOptional() @IsString() @Length(0, 400) questionEn?: string;
  @IsOptional() @IsInt() @Min(0) @Max(999) sortOrder?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

// Owner console — manage the platform onboarding script.
@ApiTags("owner")
@ApiCookieAuth()
@Controller("v1/owner/script")
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions("platform:overview")
export class ScriptAdminController {
  constructor(private readonly script: ScriptService) {}

  @Get()
  list() {
    return this.script.listAll();
  }

  @Post()
  create(@Body() body: ScriptDto) {
    return this.script.create(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: ScriptDto) {
    return this.script.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.script.remove(id);
  }
}
