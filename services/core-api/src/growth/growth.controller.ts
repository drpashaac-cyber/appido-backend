import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { GrowthService } from "./growth.service";

class ScoreDto {
  @IsOptional() @IsInt() @Min(1) @Max(1000) limit?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) activeWithinDays?: number;
}
class SegmentDto {
  @IsString() @MaxLength(80) name!: string;
  @IsObject() criteria!: Record<string, unknown>;
}
class CampaignDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsUUID() channelId?: string;
  @IsOptional() @IsString() @MaxLength(200) goal?: string;
  @IsOptional() @IsString() @MaxLength(2000) bodyText?: string;
  @IsOptional() @IsUUID() segmentId?: string;
  @IsOptional() @IsObject() criteria?: Record<string, unknown>;
}
class CopyDto {
  @IsOptional() @IsString() @MaxLength(60) tone?: string;
  @IsOptional() @IsString() @MaxLength(20) language?: string;
  @IsOptional() @IsString() @MaxLength(120) product?: string;
}

@ApiTags("growth")
@ApiCookieAuth()
@Controller("v1/growth")
@UseGuards(AuthGuard, RolesGuard)
@Roles("tenant_admin")
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  @Post("score")
  score(@Req() req: AuthedRequest, @Body() body: ScoreDto) {
    return this.growth.enqueueScore(req.rls, body);
  }

  @Get("leads")
  leads(@Req() req: AuthedRequest, @Query("minScore") minScore?: string, @Query("limit") limit?: string) {
    return this.growth.listLeads(req.rls, {
      minScore: minScore != null ? Number(minScore) : undefined,
      limit: limit != null ? Number(limit) : undefined,
    });
  }

  @Get("segments")
  segments(@Req() req: AuthedRequest) {
    return this.growth.listSegments(req.rls);
  }
  @Post("segments")
  createSegment(@Req() req: AuthedRequest, @Body() body: SegmentDto) {
    return this.growth.createSegment(req.rls, body);
  }
  @Delete("segments/:id")
  deleteSegment(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.growth.deleteSegment(req.rls, id);
  }

  @Get("campaigns")
  campaigns(@Req() req: AuthedRequest) {
    return this.growth.listCampaigns(req.rls);
  }
  @Post("campaigns")
  createCampaign(@Req() req: AuthedRequest, @Body() body: CampaignDto) {
    return this.growth.createCampaign(req.rls, body);
  }
  @Get("campaigns/:id")
  campaign(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.growth.getCampaign(req.rls, id);
  }
  @Post("campaigns/:id/copy")
  copy(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: CopyDto) {
    return this.growth.generateCopy(req.rls, id, body);
  }
  @Post("campaigns/:id/send")
  send(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.growth.send(req.rls, id);
  }
}
