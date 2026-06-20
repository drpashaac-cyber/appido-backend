import { Body, Controller, Post } from "@nestjs/common";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import { AiService } from "./ai.service";

class PublicAdvisorDto {
  @IsString() @MaxLength(1000) question!: string;
  @IsOptional() @IsIn(["en", "fa", "ar", "tr", "ru"]) lang?: string;
}

// Public — no auth, no tenant. Powers the landing support widget. Throttled to limit cost/abuse.
@ApiTags("ai")
@Controller("v1/ai")
export class AiPublicController {
  constructor(private readonly ai: AiService) {}

  @Post("advisor-public")
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  advisor(@Body() body: PublicAdvisorDto) {
    return this.ai.advisorPublic(body.question, body.lang);
  }
}
