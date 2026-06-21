import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { ScriptService } from "./script.service";

// Tenant (dashboard) — read the active onboarding script the AI will use.
@ApiTags("ai")
@ApiCookieAuth()
@Controller("v1/ai/script")
@UseGuards(AuthGuard)
export class ScriptController {
  constructor(private readonly script: ScriptService) {}

  @Get()
  list() {
    return this.script.listActive();
  }
}
