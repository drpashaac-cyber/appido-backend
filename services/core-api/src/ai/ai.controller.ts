import { Body, Controller, Get, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { PermissionsGuard } from "../authz/permissions.guard";
import { RequirePermissions } from "../authz/require-permissions.decorator";
import { AiService } from "./ai.service";

class AiConfigDto {
  @IsOptional() @IsString() channelId?: string;
  @IsOptional() @IsIn(["claude", "gpt", "gemini"]) model?: string;
  @IsOptional() @IsString() @MaxLength(60) tone?: string;
  @IsOptional() @IsString() @MaxLength(200) goal?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @IsOptional() @IsString() @MaxLength(2000) guardrails?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
class KnowledgeDto {
  @IsIn(["file", "product"]) source!: "file" | "product";
  @IsOptional() @IsString() sourceId?: string;
  @IsString() @MaxLength(50_000) text!: string;
}
class AdvisorDto {
  @IsString() @MaxLength(2000) question!: string;
}
class AiTestDto {
  @IsString() @MaxLength(2000) message!: string;
  @IsOptional() @IsString() customerId?: string;
}

@ApiTags("ai")
@ApiCookieAuth()
@Controller("v1/ai")
@UseGuards(AuthGuard, PermissionsGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get("config")
  @RequirePermissions("ai:configure")
  getConfig(@Req() req: AuthedRequest, @Query("channelId") channelId?: string) {
    return this.ai.getConfig(req.rls, channelId);
  }

  @Put("config")
  @RequirePermissions("ai:configure")
  updateConfig(@Req() req: AuthedRequest, @Body() body: AiConfigDto) {
    return this.ai.updateConfig(req.rls, body);
  }

  @Get("knowledge")
  @RequirePermissions("ai:configure")
  listKnowledge(@Req() req: AuthedRequest) {
    return this.ai.listKnowledge(req.rls);
  }

  @Post("knowledge")
  @RequirePermissions("ai:configure")
  addKnowledge(@Req() req: AuthedRequest, @Body() body: KnowledgeDto) {
    return this.ai.indexKnowledge(req.rls, body);
  }

  @Post("advisor")
  @RequirePermissions("analytics:read")
  advisor(@Req() req: AuthedRequest, @Body() body: AdvisorDto) {
    return this.ai.advisor(req.rls, body.question);
  }

  @Post("test")
  @RequirePermissions("ai:configure")
  test(@Req() req: AuthedRequest, @Body() body: AiTestDto) {
    return this.ai.test(req.rls, body.message, body.customerId);
  }
}
