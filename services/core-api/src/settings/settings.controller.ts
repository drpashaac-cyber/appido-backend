import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";

// Public — the landing page and dashboard read platform settings (e.g. trial length) from here.
@ApiTags("settings")
@Controller("v1/settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.publicView();
  }
}
