import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SettingsController } from "./settings.controller";
import { SettingsAdminController } from "./settings-admin.controller";
import { GovernanceAdminController } from "./governance-admin.controller";
import { GovernanceController } from "./governance.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [AuthModule],
  controllers: [SettingsController, SettingsAdminController, GovernanceController, GovernanceAdminController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
