import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlansController } from "./plans.controller";
import { PlansAdminController } from "./plans-admin.controller";
import { PlansService } from "./plans.service";

@Module({
  imports: [AuthModule],
  controllers: [PlansController, PlansAdminController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
