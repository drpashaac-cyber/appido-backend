import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { BOT_TOKEN_RE } from "@appido/telegram";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { TelegramService } from "./telegram.service";

class VerifyTokenDto {
  @Matches(BOT_TOKEN_RE, { message: "invalid bot token format" })
  token!: string;
}
class ConnectDto {
  @Matches(BOT_TOKEN_RE, { message: "invalid bot token format" })
  token!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}

@ApiTags("telegram")
@ApiCookieAuth()
@Controller("v1/telegram")
@UseGuards(AuthGuard, RolesGuard)
@Roles("tenant_admin")
export class TelegramController {
  constructor(private readonly tg: TelegramService) {}

  @Post("verify-token")
  verify(@Body() body: VerifyTokenDto) {
    return this.tg.verifyToken(body.token);
  }

  @Post("connect")
  connect(@Req() req: AuthedRequest, @Body() body: ConnectDto) {
    return this.tg.connect(req.rls, req.user.id, body);
  }

  @Get("status/:channelId")
  status(@Req() req: AuthedRequest, @Param("channelId") channelId: string) {
    return this.tg.status(req.rls, channelId);
  }

  @Post("disconnect/:channelId")
  disconnect(@Req() req: AuthedRequest, @Param("channelId") channelId: string) {
    return this.tg.disconnect(req.rls, req.user.id, channelId);
  }
}
