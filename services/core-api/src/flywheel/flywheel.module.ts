import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FlywheelController } from "./flywheel.controller";
import { FlywheelAdminController } from "./flywheel-admin.controller";
import { FlywheelService } from "./flywheel.service";

@Module({
  imports: [AuthModule],
  controllers: [FlywheelController, FlywheelAdminController],
  providers: [FlywheelService],
  exports: [FlywheelService],
})
export class FlywheelModule {}
